import { now, type Db, type SqlParam } from "./database";
import type { PartOfSpeech } from "./types";

/** 同梱するプリセットの1枚分（scripts/build-presets.js の出力） */
export type PresetWord = {
  id: string;
  pos: PartOfSpeech;
  term: string;
  meaning?: string;
  example?: string;
  exampleTranslation?: string;
  note?: string;
};

export type PresetIngOrTo = {
  id: string;
  term: string;
  answer?: string;
  meaning?: string;
  example?: string;
  note?: string;
};

export type PresetTip = { id: string; title: string; body?: string; url?: string };

export type PresetData = {
  version: string;
  words: PresetWord[];
  ingOrTo: PresetIngOrTo[];
  tips: PresetTip[];
};

export const PRESET_WORDS_DECK_ID = "preset:words";
export const PRESET_ING_OR_TO_DECK_ID = "preset:ing-or-to";

/** 「～ing」「to～」のように書かれた答えを、"ing" / "to" にそろえる */
export const normalizeIngOrTo = (answer: string | undefined): string => {
  const text = (answer ?? "").toLowerCase();
  if (text.includes("ing")) return "ing";
  if (text.includes("to")) return "to";
  return "";
};

const META_PRESET_VERSION = "preset_version";

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
 * 同梱のプリセットを DB に反映する
 * - 前回と同じ内容なら何もしない
 * - 内容が変わったら、プリセットの単語帳だけを入れ直す（ユーザーが作ったデータには触れない）
 * - 途中で失敗しても、トランザクションで元の状態に戻る
 */
export async function syncPresets(db: Db, data: PresetData): Promise<boolean> {
  const saved = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [META_PRESET_VERSION]);
  if (saved?.value === data.version) return false;

  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE kind = 'preset')");
    await db.runAsync("DELETE FROM tips");

    const upsertDeck = `INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES (?, ?, 'preset', ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = NULL`;
    await db.runAsync(upsertDeck, [PRESET_WORDS_DECK_ID, "英単語・熟語（標準）", timestamp, timestamp]);
    await db.runAsync(upsertDeck, [PRESET_ING_OR_TO_DECK_ID, "ing or to", timestamp, timestamp]);

    const insertCards = `INSERT INTO cards
      (id, deck_id, type, term, meaning, part_of_speech, example, example_translation, note, answer, position, created_at, updated_at)`;

    await insertRows(db, insertCards, [
      ...data.words.map((word, index): SqlParam[] => [
        word.id, PRESET_WORDS_DECK_ID, "basic", word.term, word.meaning ?? "", word.pos,
        word.example ?? "", word.exampleTranslation ?? "", word.note ?? "", "", index, timestamp, timestamp,
      ]),
      ...data.ingOrTo.map((item, index): SqlParam[] => [
        item.id, PRESET_ING_OR_TO_DECK_ID, "ing_or_to", item.term, item.meaning ?? "", null,
        item.example ?? "", "", item.note ?? "", normalizeIngOrTo(item.answer), index, timestamp, timestamp,
      ]),
    ]);
    await insertRows(
      db,
      "INSERT INTO tips (id, title, body, url)",
      data.tips.map((tip): SqlParam[] => [tip.id, tip.title, tip.body ?? "", tip.url ?? ""])
    );

    await db.runAsync(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [META_PRESET_VERSION, data.version]
    );
  });
  return true;
}
