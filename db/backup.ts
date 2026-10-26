import type { Db, SqlParam } from "./database";
import { toFlag, PARTS_OF_SPEECH } from "./types";

/**
 * バックアップ（全データの書き出しと復元）
 * - 自分の単語帳・単語・例文・フラグ・学習の記録を、1つの JSON にする（学習の記録のグラフも含む）
 * - 同梱のデータ（ing or to、ヒント）は含めない（アプリに入っている）
 * - 復元は、今の自分のデータを、ファイルの内容で置き換える（ID はそのまま残す）
 */

export const BACKUP_FORMAT = "vocabook-backup";
export const BACKUP_VERSION = 1;
/** 保存先のフォルダに作るファイルの名前。毎回、同じ名前のファイルを上書きする */
export const BACKUP_FILE_NAME = "vocabook-backup.json";

/** ファイルの中の、個々の値の上限（壊れたファイルや、大きすぎるファイルで、アプリが重くならないように） */
const LIMITS = { decks: 1000, cards: 200_000, examples: 2_000_000, studyLog: 5_000_000, text: 20_000 } as const;

export type BackupDeck = { id: string; name: string; created_at: number; updated_at: number };
export type BackupCard = {
  id: string; deck_id: string; term: string; meaning: string; part_of_speech: string | null; note: string; answer: string;
  position: number; created_at: number; updated_at: number; flag: string; learned_day: string | null;
};
export type BackupExample = { id: string; card_id: string; position: number; text: string; translation: string };
export type BackupStudyLog = { day: string; card_id: string };

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  decks: BackupDeck[];
  cards: BackupCard[];
  examples: BackupExample[];
  studyLog: BackupStudyLog[];
};

export class BackupError extends Error {}

/** 自分のデータを、バックアップのデータにする */
export async function exportBackup(db: Db, exportedAt: Date = new Date()): Promise<BackupFile> {
  const decks = await db.getAllAsync<BackupDeck>(
    "SELECT id, name, created_at, updated_at FROM decks WHERE kind = 'user' AND deleted_at IS NULL ORDER BY created_at, id"
  );
  const cards = await db.getAllAsync<BackupCard>(
    `SELECT id, deck_id, term, meaning, part_of_speech, note, answer, position, created_at, updated_at, flag, learned_day
     FROM cards WHERE type = 'basic' AND deleted_at IS NULL AND deck_id IN (SELECT id FROM decks WHERE kind = 'user' AND deleted_at IS NULL)
     ORDER BY deck_id, position, created_at, id`
  );
  const live = "card_id IN (SELECT id FROM cards WHERE type = 'basic' AND deleted_at IS NULL AND deck_id IN (SELECT id FROM decks WHERE kind = 'user' AND deleted_at IS NULL))";
  const examples = await db.getAllAsync<BackupExample>(`SELECT id, card_id, position, text, translation FROM card_examples WHERE ${live} ORDER BY card_id, position`);
  const studyLog = await db.getAllAsync<BackupStudyLog>(`SELECT day, card_id FROM study_log WHERE ${live} ORDER BY day, card_id`);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), decks, cards, examples, studyLog };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, field: string, max: number = LIMITS.text): string => {
  if (typeof value !== "string") throw new BackupError(`ファイルの内容が正しくありません（${field}）`);
  if (value.length > max) throw new BackupError(`ファイルの内容が大きすぎます（${field}）`);
  return value;
};
const int = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new BackupError(`ファイルの内容が正しくありません（${field}）`);
  return value;
};
const list = (value: unknown, field: string, max: number): unknown[] => {
  if (!Array.isArray(value)) throw new BackupError(`ファイルの内容が正しくありません（${field}）`);
  if (value.length > max) throw new BackupError(`ファイルの内容が大きすぎます（${field}）`);
  return value;
};

/**
 * ファイルの文字を読んで、検証する。バックアップのファイルでなければ BackupError
 * 値は、アプリの決まり（品詞・フラグ）に合わせて整える。合わない値は、空にする
 */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("バックアップのファイルではありません（読み取れませんでした）");
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) throw new BackupError("vocabook のバックアップのファイルではありません");
  const version = int(data.version, "version");
  if (version > BACKUP_VERSION) throw new BackupError("このアプリより新しい版のバックアップです。アプリを更新してください");

  const decks = list(data.decks, "decks", LIMITS.decks).map((raw): BackupDeck => {
    if (!isObject(raw)) throw new BackupError("ファイルの内容が正しくありません（decks）");
    return { id: str(raw.id, "deck.id", 200), name: str(raw.name, "deck.name", 400), created_at: int(raw.created_at, "deck.created_at"), updated_at: int(raw.updated_at, "deck.updated_at") };
  });
  const deckIds = new Set(decks.map((deck) => deck.id));

  const cards = list(data.cards, "cards", LIMITS.cards).map((raw): BackupCard => {
    if (!isObject(raw)) throw new BackupError("ファイルの内容が正しくありません（cards）");
    const deckId = str(raw.deck_id, "card.deck_id", 200);
    if (!deckIds.has(deckId)) throw new BackupError("ファイルの内容が正しくありません（単語帳のない単語があります）");
    const pos = raw.part_of_speech;
    return {
      id: str(raw.id, "card.id", 200),
      deck_id: deckId,
      term: str(raw.term, "card.term"),
      meaning: str(raw.meaning, "card.meaning"),
      part_of_speech: typeof pos === "string" && PARTS_OF_SPEECH.some((p) => p.key === pos) ? pos : null,
      note: str(raw.note ?? "", "card.note"),
      answer: raw.answer === "ing" || raw.answer === "to" ? raw.answer : "",
      position: int(raw.position, "card.position"),
      created_at: int(raw.created_at, "card.created_at"),
      updated_at: int(raw.updated_at, "card.updated_at"),
      flag: toFlag(typeof raw.flag === "string" ? raw.flag : ""),
      learned_day: typeof raw.learned_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.learned_day) ? raw.learned_day : null,
    };
  });
  const cardIds = new Set(cards.map((card) => card.id));
  if (cardIds.size !== cards.length) throw new BackupError("ファイルの内容が正しくありません（同じ ID の単語があります）");

  const examples = list(data.examples, "examples", LIMITS.examples).map((raw): BackupExample => {
    if (!isObject(raw)) throw new BackupError("ファイルの内容が正しくありません（examples）");
    const cardId = str(raw.card_id, "example.card_id", 200);
    if (!cardIds.has(cardId)) throw new BackupError("ファイルの内容が正しくありません（単語のない例文があります）");
    return { id: str(raw.id, "example.id", 200), card_id: cardId, position: int(raw.position, "example.position"), text: str(raw.text ?? "", "example.text"), translation: str(raw.translation ?? "", "example.translation") };
  });

  const studyLog = list(data.studyLog, "studyLog", LIMITS.studyLog).map((raw): BackupStudyLog => {
    if (!isObject(raw)) throw new BackupError("ファイルの内容が正しくありません（studyLog）");
    const day = str(raw.day, "studyLog.day", 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BackupError("ファイルの内容が正しくありません（日付）");
    return { day, card_id: str(raw.card_id, "studyLog.card_id", 200) };
  });

  return { format: BACKUP_FORMAT, version, exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "", decks, cards, examples, studyLog };
}

/** 複数行を、まとめて INSERT する（端末の SQLite は、1行ずつより、ずっと速い） */
async function insertRows(db: Db, prefix: string, rows: SqlParam[][], rowsPerStatement: number): Promise<void> {
  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const chunk = rows.slice(start, start + rowsPerStatement);
    const placeholders = chunk.map((row) => `(${row.map(() => "?").join(", ")})`).join(", ");
    await db.runAsync(`${prefix} VALUES ${placeholders}`, chunk.flat());
  }
}

/**
 * 今の自分のデータを、バックアップの内容で置き換える（1回のトランザクション。途中で失敗しても、元のまま）
 * 同梱のデータ（ing or to、ヒント）には、触らない。戻り値は、復元した単語の数
 */
export async function restoreBackup(db: Db, backup: BackupFile): Promise<number> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM card_examples WHERE card_id IN (SELECT id FROM cards WHERE type = 'basic')");
    await db.runAsync("DELETE FROM study_log");
    await db.runAsync("DELETE FROM cards WHERE type = 'basic'");
    await db.runAsync("DELETE FROM decks WHERE kind = 'user'");

    await insertRows(
      db,
      "INSERT INTO decks (id, name, kind, created_at, updated_at)",
      backup.decks.map((d): SqlParam[] => [d.id, d.name, "user", d.created_at, d.updated_at]),
      50
    );
    await insertRows(
      db,
      "INSERT INTO cards (id, deck_id, type, term, meaning, part_of_speech, note, answer, position, created_at, updated_at, flag, learned_day)",
      backup.cards.map((c): SqlParam[] => [c.id, c.deck_id, "basic", c.term, c.meaning, c.part_of_speech, c.note, c.answer, c.position, c.created_at, c.updated_at, c.flag, c.learned_day]),
      50
    );
    await insertRows(
      db,
      "INSERT INTO card_examples (id, card_id, position, text, translation)",
      backup.examples.map((e): SqlParam[] => [e.id, e.card_id, e.position, e.text, e.translation]),
      100
    );
    await insertRows(db, "INSERT OR IGNORE INTO study_log (day, card_id)", backup.studyLog.map((l): SqlParam[] => [l.day, l.card_id]), 200);
  });
  return backup.cards.length;
}

/** 設定の保存先（meta 表のキー） */
export const META_BACKUP_FOLDER = "backup_folder_uri";
export const META_BACKUP_FOLDER_NAME = "backup_folder_name";
export const META_BACKUP_LAST_AT = "backup_last_at";
export const META_BACKUP_LAST_ERROR = "backup_last_error";

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) await db.runAsync("DELETE FROM meta WHERE key = ?", [key]);
  else await db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

/**
 * 自動バックアップをするか: 保存先があり、今日（端末の日付）まだバックアップしていないとき
 * lastAt は、前回のバックアップの日時（ISO）。day は、その日時を端末の日付にしたもの
 */
export function shouldAutoBackup(options: { folder: string | null; lastAt: string | null; today: string; dayOf: (iso: string) => string }): boolean {
  if (!options.folder) return false;
  if (!options.lastAt) return true;
  return options.dayOf(options.lastAt) !== options.today;
}
