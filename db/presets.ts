import { newId, now, type Db, type SqlParam } from "./database";
import type { PartOfSpeech } from "./types";

/**
 * アプリに同梱するデータ（scripts/build-presets.js の出力）
 * 単語帳は同梱しない。同梱するのは ing or to の問題と、ホームのヒントだけ
 */
export type PresetIngOrTo = {
  id: string;
  term: string;
  answer?: string;
  meaning?: string;
  example?: string;
  note?: string;
};

/** title は空でもよい（ホームでは本文だけを表示する） */
export type PresetTip = { id: string; title?: string; body?: string; url?: string };

export type PresetData = {
  version: string;
  ingOrTo: PresetIngOrTo[];
  tips: PresetTip[];
};

/** ing or to の問題を入れておく、読み取り専用の単語帳（一覧には出さない） */
export const PRESET_ING_OR_TO_DECK_ID = "preset:ing-or-to";

/** 初回起動時に用意する、空の単語帳の名前 */
export const DEFAULT_DECK_NAME = "マイ単語帳";

/** 「～ing」「to～」のように書かれた答えを、"ing" / "to" にそろえる */
export const normalizeIngOrTo = (answer: string | undefined): string => {
  const text = (answer ?? "").toLowerCase();
  if (text.includes("ing")) return "ing";
  if (text.includes("to")) return "to";
  return "";
};

const META_PRESET_VERSION = "preset_version";
const META_DEFAULT_DECK_CREATED = "default_deck_created";

/**
 * 複数行をまとめて INSERT する
 * 端末の SQLite は呼び出し1回ごとの負担が大きいため、1行ずつより大幅に速い
 * 1文に入れる値の数は、SQLite の上限（32766）よりずっと小さく保つ
 */
async function insertRows(db: Db, insertPrefix: string, rows: SqlParam[][], rowsPerStatement = 50): Promise<void> {
  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const chunk = rows.slice(start, start + rowsPerStatement);
    const placeholders = chunk.map((row) => `(${row.map(() => "?").join(", ")})`).join(", ");
    await db.runAsync(`${insertPrefix} VALUES ${placeholders}`, chunk.flat());
  }
}

/**
 * 同梱のデータを DB に反映する
 * - 前回と同じ内容なら何もしない
 * - 内容が変わったら、同梱の読み取り専用データ（kind = 'preset'）だけを入れ直す
 *   以前の版で同梱していた単語帳もここで消える。ユーザーが作ったデータには触れない
 * - 途中で失敗しても、トランザクションで元の状態に戻る
 */
export async function syncPresets(db: Db, data: PresetData): Promise<boolean> {
  const saved = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [META_PRESET_VERSION]);
  if (saved?.value === data.version) return false;

  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE kind = 'preset')");
    await db.runAsync("DELETE FROM decks WHERE kind = 'preset' AND id <> ?", [PRESET_ING_OR_TO_DECK_ID]);
    await db.runAsync("DELETE FROM tips");

    await db.runAsync(
      `INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES (?, ?, 'preset', ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = NULL`,
      [PRESET_ING_OR_TO_DECK_ID, "ing or to", timestamp, timestamp]
    );
    await insertRows(
      db,
      `INSERT INTO cards
        (id, deck_id, type, term, meaning, part_of_speech, example, example_translation, note, answer, position, created_at, updated_at)`,
      data.ingOrTo.map((item, index): SqlParam[] => [
        item.id, PRESET_ING_OR_TO_DECK_ID, "ing_or_to", item.term, item.meaning ?? "", null,
        item.example ?? "", "", item.note ?? "", normalizeIngOrTo(item.answer), index, timestamp, timestamp,
      ])
    );
    await insertRows(
      db,
      "INSERT INTO tips (id, title, body, url)",
      data.tips.map((tip): SqlParam[] => [tip.id, tip.title ?? "", tip.body ?? "", tip.url ?? ""])
    );

    await db.runAsync(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [META_PRESET_VERSION, data.version]
    );
  });
  return true;
}

/** 既定の単語（presets-src/default-words の Markdown から作る）。単語帳の「既定の単語を追加」で、追加できる */
export type DefaultWord = {
  term: string;
  meaning: string;
  partOfSpeech: PartOfSpeech;
  example?: string;
  exampleTranslation?: string;
  note?: string;
};

/**
 * 初回起動時に、空の単語帳を1つ用意する（すぐに単語を追加できるように。単語は入れない）
 * 一度用意したら、ユーザーが単語帳をすべて削除しても作り直さない
 */
export async function ensureDefaultDeck(db: Db): Promise<void> {
  const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [META_DEFAULT_DECK_CREATED]);
  if (done) return;

  const timestamp = now();
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM decks WHERE kind = 'user' AND deleted_at IS NULL");
    if ((existing?.n ?? 0) === 0) {
      await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES (?, ?, 'user', ?, ?)", [
        newId(), DEFAULT_DECK_NAME, timestamp, timestamp,
      ]);
    }
    await db.runAsync("INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      META_DEFAULT_DECK_CREATED,
    ]);
  });
}
