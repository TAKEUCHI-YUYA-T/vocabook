import { newId, type Db, type SqlParam } from "./database";
import { appendExtraToNote, compactExamples, extraExamplesNote, MAX_EXAMPLES, pairExamples, type Example } from "./examples";

/** 移行4の時点の、1つの単語の例文の数。移行4と5は、この数を前提にした手順なので、MAX_EXAMPLES が変わっても変えない */
const LEGACY_EXAMPLE_SLOTS = 3;

/**
 * データ構造の変更履歴
 * 公開後は、既存ユーザーのデータを壊さないよう、過去の項目は書き換えず、
 * 新しい番号の変更を末尾に足していく。PRAGMA user_version で適用済みの番号を管理する
 */
/** 変更は、SQL か、SQL だけでは書けないデータの整形（関数）。関数も、変更ごとのトランザクションの中で動く */
type Migration = string | ((db: Db) => Promise<void>);

/**
 * 4: 例文を、最大3つに分ける（英文と和訳の対）。例文1は、これまでの example / example_translation の列をそのまま使う
 * 今までは、1つの欄に「①…②…」と並べていた。番号と空行で分けて、例文ごとの列に入れ直す。
 * 4つ目以降の例文は、メモの末尾に移す（捨てない）
 * 整形の前の値は、example_migration_backup に残す（戻せるように。画面からは使わない）
 */
async function splitExamplesMigration(db: Db): Promise<void> {
  await db.execAsync(`
    ALTER TABLE cards ADD COLUMN example2 TEXT NOT NULL DEFAULT '';
    ALTER TABLE cards ADD COLUMN example2_translation TEXT NOT NULL DEFAULT '';
    ALTER TABLE cards ADD COLUMN example3 TEXT NOT NULL DEFAULT '';
    ALTER TABLE cards ADD COLUMN example3_translation TEXT NOT NULL DEFAULT '';
    CREATE TABLE example_migration_backup (
      card_id TEXT PRIMARY KEY NOT NULL,
      example TEXT NOT NULL,
      example_translation TEXT NOT NULL,
      note TEXT NOT NULL
    );
  `);
  const rows = await db.getAllAsync<{ id: string; example: string; example_translation: string; note: string }>(
    "SELECT id, example, example_translation, note FROM cards WHERE type = 'basic' AND (example <> '' OR example_translation <> '')"
  );
  for (const row of rows) {
    const { examples, extra } = pairExamples(row.example, row.example_translation, LEGACY_EXAMPLE_SLOTS);
    const [first, second, third] = [examples[0], examples[1], examples[2]];
    const unchanged = examples.length === 1 && first.text === row.example.trim() && first.translation === row.example_translation.trim();
    if (unchanged) continue;
    await db.runAsync("INSERT INTO example_migration_backup (card_id, example, example_translation, note) VALUES (?, ?, ?, ?)", [
      row.id, row.example, row.example_translation, row.note,
    ]);
    await db.runAsync(
      "UPDATE cards SET example = ?, example_translation = ?, example2 = ?, example2_translation = ?, example3 = ?, example3_translation = ?, note = ? WHERE id = ?",
      [first?.text ?? "", first?.translation ?? "", second?.text ?? "", second?.translation ?? "", third?.text ?? "", third?.translation ?? "", appendExtraToNote(row.note, extra, LEGACY_EXAMPLE_SLOTS), row.id]
    );
  }
}

/** メモの末尾にある block（移行4が足した「例文の続き」）を取り除く。メモがその形でなければ（手で直されていれば）null */
function stripTrailingBlock(note: string, block: string): string | null {
  if (note === block) return "";
  if (note.endsWith(`\n\n${block}`)) return note.slice(0, note.length - block.length - 2).trimEnd();
  return null;
}

/**
 * 5: 例文を、単語とは別の表（card_examples。1例文を1行）に持つ。数は MAX_EXAMPLES（20）まで
 * - 単語の表の、例文1〜3の列（英文と訳）を、例文の表に移す（ing or to の問題の例文も）
 * - 移行4でメモに移した4つ目以降の例文は、メモから消して、例文に戻す。元の値（example_migration_backup）から取り直す
 *   メモが手で直されていて、移した文がそのまま残っていなければ、メモには触らず、例文にも足さない（二重にならないように）
 * 単語の表の、例文の列は、使わなくなる（消さずに残す）
 */
async function moveExamplesToTable(db: Db): Promise<void> {
  await db.execAsync(`
    CREATE TABLE card_examples (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      translation TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_card_examples_card ON card_examples (card_id, position);
  `);
  type Row = {
    id: string; note: string; example: string; example_translation: string; example2: string; example2_translation: string; example3: string; example3_translation: string;
  };
  const rows = await db.getAllAsync<Row>(
    `SELECT id, note, example, example_translation, example2, example2_translation, example3, example3_translation FROM cards
     WHERE example <> '' OR example_translation <> '' OR example2 <> '' OR example2_translation <> '' OR example3 <> '' OR example3_translation <> ''`
  );
  const backups = new Map(
    (await db.getAllAsync<{ card_id: string; example: string; example_translation: string }>("SELECT card_id, example, example_translation FROM example_migration_backup")).map((b) => [b.card_id, b])
  );

  const inserts: SqlParam[][] = [];
  for (const row of rows) {
    let examples: Example[] = compactExamples([
      { text: row.example, translation: row.example_translation },
      { text: row.example2, translation: row.example2_translation },
      { text: row.example3, translation: row.example3_translation },
    ]);
    const backup = backups.get(row.id);
    if (backup) {
      const legacy = pairExamples(backup.example, backup.example_translation, LEGACY_EXAMPLE_SLOTS);
      const stripped = legacy.extra.length > 0 ? stripTrailingBlock(row.note, extraExamplesNote(legacy.extra, LEGACY_EXAMPLE_SLOTS)) : null;
      if (stripped !== null) {
        const all = pairExamples(backup.example, backup.example_translation, MAX_EXAMPLES);
        examples = [...examples, ...all.examples.slice(LEGACY_EXAMPLE_SLOTS)];
        // 20個を超える分（ふつうは、ない）は、メモに残す
        await db.runAsync("UPDATE cards SET note = ? WHERE id = ?", [appendExtraToNote(stripped, all.extra), row.id]);
      }
    }
    examples.forEach((example, position) => inserts.push([newId(), row.id, position, example.text, example.translation]));
  }
  for (let start = 0; start < inserts.length; start += 100) {
    const chunk = inserts.slice(start, start + 100);
    await db.runAsync(
      `INSERT INTO card_examples (id, card_id, position, text, translation) VALUES ${chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
      chunk.flat()
    );
  }
}

const MIGRATIONS: Migration[] = [
  // 1: 初期構造
  `
  CREATE TABLE decks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('preset', 'user')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    type TEXT NOT NULL DEFAULT 'basic' CHECK (type IN ('basic', 'ing_or_to')),
    term TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    part_of_speech TEXT,
    example TEXT NOT NULL DEFAULT '',
    example_translation TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_cards_deck ON cards (deck_id, deleted_at, position);

  CREATE TABLE tips (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // 2: 学習のフラグ（覚えた / 要復習）と、学習の記録（いつ、どの単語を見たか）
  `
  ALTER TABLE cards ADD COLUMN flag TEXT NOT NULL DEFAULT '' CHECK (flag IN ('', 'learned', 'review'));

  CREATE TABLE study_log (
    day TEXT NOT NULL,
    card_id TEXT NOT NULL,
    PRIMARY KEY (day, card_id)
  );
  `,
  // 3: 「覚えた」にした日（覚えた単語の推移のグラフ用）。すでに「覚えた」の単語は、更新した日にする
  `
  ALTER TABLE cards ADD COLUMN learned_day TEXT;
  UPDATE cards SET learned_day = date('now', 'localtime') WHERE flag = 'learned';
  `,
  // 4: 例文を最大3つに分ける
  splitExamplesMigration,
  // 5: 例文を、別の表に持つ（1つの単語に、20個まで）
  moveExamplesToTable,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

/**
 * 未適用の変更を順番に適用する（upTo は、そこまでで止める番号。テストで、古い版から更新するときに使う）
 * 変更ごとにトランザクションで囲み、途中で失敗しても半端な状態を残さない
 */
export async function migrate(db: Db, upTo: number = LATEST_SCHEMA_VERSION): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  if (current > LATEST_SCHEMA_VERSION) {
    // このアプリより新しい版で作られたデータ。古いアプリで開いて壊さないよう、止める
    throw new Error(`データの版（${current}）が、このアプリの対応（${LATEST_SCHEMA_VERSION}）より新しいです。アプリを更新してください`);
  }

  for (let version = current + 1; version <= Math.min(upTo, LATEST_SCHEMA_VERSION); version++) {
    await db.withTransactionAsync(async () => {
      const migration = MIGRATIONS[version - 1];
      if (typeof migration === "string") await db.execAsync(migration);
      else await migration(db);
      // PRAGMA はバインド変数を使えないため、整数であることを確かめて埋め込む
      await db.execAsync(`PRAGMA user_version = ${Number(version)}`);
    });
  }
}
