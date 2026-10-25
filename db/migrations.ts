import type { Db } from "./database";
import { appendExtraToNote, pairExamples } from "./examples";

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
    const { examples, extra } = pairExamples(row.example, row.example_translation);
    const [first, second, third] = [examples[0], examples[1], examples[2]];
    const unchanged = examples.length === 1 && first.text === row.example.trim() && first.translation === row.example_translation.trim();
    if (unchanged) continue;
    await db.runAsync("INSERT INTO example_migration_backup (card_id, example, example_translation, note) VALUES (?, ?, ?, ?)", [
      row.id, row.example, row.example_translation, row.note,
    ]);
    await db.runAsync(
      "UPDATE cards SET example = ?, example_translation = ?, example2 = ?, example2_translation = ?, example3 = ?, example3_translation = ?, note = ? WHERE id = ?",
      [first?.text ?? "", first?.translation ?? "", second?.text ?? "", second?.translation ?? "", third?.text ?? "", third?.translation ?? "", appendExtraToNote(row.note, extra), row.id]
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
