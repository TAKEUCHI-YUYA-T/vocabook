import { now, type Db, type SqlParam } from "./database";
import type { PartOfSpeech } from "./types";

/**
 * 一度だけ行う、単語データの修正（2026-10-23）
 * 開発者の端末に取り込んだ単語の、綴りミス・品詞の誤り・重複を直す（scripts で調べた結果）
 *
 * 安全のための決まり
 * - 開発者の端末のデータだと確かめられたとき（下の綴りミスの語が、決まった数以上ある）だけ動く。ほかの端末では何もしない
 * - 直すのは、単語と品詞が完全に一致する行が、1 件だけあるときに限る（ない・複数ある場合は、飛ばして記録する）
 * - 直す前の行は、meta に控えとして残す（元に戻せるように）。削除は論理削除（deleted_at）
 * - 一度動いたら、二度と動かない（meta に記録する）
 * 修正が済んだら、このファイルと呼び出しは消してよい
 */

export const DATA_FIX_KEY = "data_fix_20261023";
export const DATA_FIX_BACKUP_KEY = "data_fix_20261023_backup";

/**
 * 綴りミス・単語の誤りを、正しい綴りに直す
 * 綴りミスは、同じ行の例文などにある同じ綴りミスも直す。語形の変更（fixText: false。paid → pay など）では、例文は変えない
 */
const RENAMES: { from: string; to: string; pos: PartOfSpeech; fixText?: false }[] = [
  { from: "beverge", to: "beverage", pos: "noun" },
  { from: "inducetry", to: "industry", pos: "noun" },
  { from: "tranceportation", to: "transportation", pos: "noun" },
  { from: "lamdscaing", to: "landscaping", pos: "noun" },
  { from: "ocasion", to: "occasion", pos: "noun" },
  { from: "agricultual", to: "agricultural", pos: "adjective" },
  { from: "untill（till）", to: "until（till）", pos: "conjunction" },
  { from: "neverthless", to: "nevertheless", pos: "conjunction" },
  { from: "make sence", to: "make sense", pos: "idiom" },
  // 意味・例文が原形のもの
  { from: "handled", to: "handle", pos: "verb", fixText: false },
  // 名詞「給料」は pay（paid は形容詞）
  { from: "paid", to: "pay", pos: "noun", fixText: false },
];

/** 品詞の誤りを直す */
const POS_CHANGES: { term: string; from: PartOfSpeech; to: PartOfSpeech }[] = [
  { term: "anxious", from: "verb", to: "adjective" },
  { term: "defective", from: "adverb", to: "adjective" },
  { term: "alternative", from: "adverb", to: "adjective" },
  { term: "particular", from: "idiom", to: "adjective" },
  { term: "long-held", from: "idiom", to: "adjective" },
];

/** 正しい綴りの行がすでにある綴りミスの行は、削除する（意味が空か、正しい行と同じときだけ） */
const DUPLICATES: { typo: string; correct: string; pos: PartOfSpeech }[] = [
  { typo: "streamling", correct: "streamlining", pos: "noun" },
  { typo: "comittee", correct: "committee", pos: "noun" },
  { typo: "futher", correct: "further", pos: "adjective" },
];

/** 綴りミスの行の意味を、正しい綴りの行の意味に足して、綴りミスの行を削除する */
const MERGES: { typo: string; correct: string; pos: PartOfSpeech }[] = [{ typo: "exective", correct: "executive", pos: "noun" }];

/** 開発者の端末のデータか確かめるための語（これらの綴りミスが、まとめてある端末は、ほかにまずない） */
const SIGNATURE = ["beverge", "inducetry", "tranceportation", "lamdscaing", "ocasion", "agricultual", "neverthless", "streamling", "comittee", "exective", "futher"];
const SIGNATURE_MIN = 5;

type Row = { id: string; term: string; meaning: string; part_of_speech: string | null; example: string; example_translation: string; note: string };

export type DataFixSummary = { status: "applied" | "not-applicable"; applied: string[]; skipped: string[] };

const findRows = (db: Db, term: string, pos: PartOfSpeech) =>
  db.getAllAsync<Row>(
    `SELECT c.id, c.term, c.meaning, c.part_of_speech, c.example, c.example_translation, c.note
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE d.kind = 'user' AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND c.type = 'basic' AND c.term = ? AND c.part_of_speech = ?`,
    [term, pos]
  );

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 一度だけの修正を行う。すでに済んでいれば null */
export async function applyDataFixes(db: Db): Promise<DataFixSummary | null> {
  const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [DATA_FIX_KEY]);
  if (done) return null;

  const summary: DataFixSummary = { status: "applied", applied: [], skipped: [] };
  const backup: Row[] = [];
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    const placeholders = SIGNATURE.map(() => "?").join(", ");
    const signature = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(DISTINCT c.term) AS n FROM cards c JOIN decks d ON d.id = c.deck_id
       WHERE d.kind = 'user' AND d.deleted_at IS NULL AND c.deleted_at IS NULL AND c.term IN (${placeholders})`,
      SIGNATURE
    );

    if ((signature?.n ?? 0) >= SIGNATURE_MIN) {
      const update = async (row: Row, changes: Partial<Pick<Row, "term" | "meaning" | "part_of_speech" | "example" | "example_translation" | "note">>) => {
        backup.push(row);
        const keys = Object.keys(changes) as (keyof typeof changes)[];
        const params: SqlParam[] = [...keys.map((key) => changes[key] ?? null), timestamp, row.id];
        await db.runAsync(`UPDATE cards SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, params);
      };
      const remove = async (row: Row) => {
        backup.push(row);
        await db.runAsync("UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?", [timestamp, timestamp, row.id]);
      };

      for (const fix of RENAMES) {
        const rows = await findRows(db, fix.from, fix.pos);
        if (rows.length !== 1) {
          summary.skipped.push(`${fix.from}: 対象が ${rows.length} 件`);
          continue;
        }
        if ((await findRows(db, fix.to, fix.pos)).length > 0) {
          summary.skipped.push(`${fix.from}: ${fix.to} がすでにある`);
          continue;
        }
        const row = rows[0];
        if (fix.fixText === false) {
          await update(row, { term: fix.to });
        } else {
          // 同じ行の意味・例文・訳・メモにある、同じ綴りミスも直す（語の一部は直さない）
          const word = fix.from.replace(/[（(].*$/, "").trim();
          const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
          const correct = fix.to.replace(/[（(].*$/, "").trim();
          // 文頭などで大文字だった綴りミスは、直したあとも大文字で始める
          const replacement = (match: string) => (match[0] !== match[0].toLowerCase() ? correct[0].toUpperCase() + correct.slice(1) : correct);
          await update(row, {
            term: fix.to,
            meaning: row.meaning.replace(pattern, replacement),
            example: row.example.replace(pattern, replacement),
            example_translation: row.example_translation.replace(pattern, replacement),
            note: row.note.replace(pattern, replacement),
          });
        }
        summary.applied.push(`綴り: ${fix.from} → ${fix.to}`);
      }

      for (const fix of POS_CHANGES) {
        const rows = await findRows(db, fix.term, fix.from);
        if (rows.length !== 1) {
          summary.skipped.push(`${fix.term}（${fix.from}）: 対象が ${rows.length} 件`);
          continue;
        }
        await update(rows[0], { part_of_speech: fix.to });
        summary.applied.push(`品詞: ${fix.term} ${fix.from} → ${fix.to}`);
      }

      for (const fix of DUPLICATES) {
        const typos = await findRows(db, fix.typo, fix.pos);
        const corrects = await findRows(db, fix.correct, fix.pos);
        if (typos.length !== 1 || corrects.length === 0) {
          summary.skipped.push(`${fix.typo}: 綴りミスの行 ${typos.length} 件、正しい行 ${corrects.length} 件`);
          continue;
        }
        const typo = typos[0];
        if (typo.meaning !== "" && !corrects.some((row) => row.meaning === typo.meaning)) {
          summary.skipped.push(`${fix.typo}: 正しい行と意味が違う`);
          continue;
        }
        await remove(typo);
        summary.applied.push(`削除: ${fix.typo}（${fix.correct} と重複）`);
      }

      for (const fix of MERGES) {
        const typos = await findRows(db, fix.typo, fix.pos);
        const corrects = await findRows(db, fix.correct, fix.pos);
        if (typos.length !== 1 || corrects.length !== 1) {
          summary.skipped.push(`${fix.typo}: 綴りミスの行 ${typos.length} 件、正しい行 ${corrects.length} 件`);
          continue;
        }
        const [typo, correct] = [typos[0], corrects[0]];
        if (typo.meaning && !correct.meaning.includes(typo.meaning)) {
          await update(correct, { meaning: correct.meaning ? `${correct.meaning}、${typo.meaning}` : typo.meaning });
        }
        await remove(typo);
        summary.applied.push(`統合: ${fix.typo} → ${fix.correct}`);
      }
    } else {
      summary.status = "not-applicable";
    }

    await db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [DATA_FIX_KEY, JSON.stringify(summary)]);
    if (backup.length > 0) {
      await db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
        DATA_FIX_BACKUP_KEY,
        JSON.stringify(backup),
      ]);
    }
  });

  return summary;
}
