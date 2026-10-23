import type { CardFlag, StudyDirection } from "./types";

/**
 * 「学習の範囲」画面の件数の計算（画面から切り離して、テストできるようにしている）
 * 品詞とフラグの組み合わせごとの数（repository.studyBreakdown）から、選んだ条件に合う数を求める
 */
export type BreakdownRow = { partOfSpeech: string; flag: string; count: number; withMeaning: number };

export type StudySelection = {
  /** 選んだ品詞のキー。空なら、すべて（品詞が未設定の単語も含む） */
  parts: string[];
  /** 選んだフラグ（"" は未設定）。空なら、すべて */
  flags: CardFlag[];
  /** 意味のある単語だけ数える（日本語を見て英語を答える出題のため） */
  needMeaning: boolean;
};

/** 画面から学習画面へ渡す、フラグの文字（未設定は none）。空なら、すべて */
export const encodeFlags = (flags: CardFlag[]): string => flags.map((flag) => flag || "none").join(",");

/** encodeFlags の逆。知らない値は無視する */
export function decodeFlags(text: string | undefined): CardFlag[] {
  const flags: CardFlag[] = [];
  for (const part of (text ?? "").split(",")) {
    const flag: CardFlag | null = part === "none" ? "" : part === "learned" || part === "review" ? part : null;
    if (flag !== null && !flags.includes(flag)) flags.push(flag);
  }
  return flags;
}

/** 出題の向きを、学習画面に渡された文字から読む。知らない値は、英語→日本語 */
export const decodeDirection = (text: string | undefined): StudyDirection => (text === "ja-en" || text === "listen" ? text : "en-ja");

const amount = (row: BreakdownRow, needMeaning: boolean) => (needMeaning ? row.withMeaning : row.count);

const inParts = (row: BreakdownRow, parts: string[]) => parts.length === 0 || parts.includes(row.partOfSpeech);
const inFlags = (row: BreakdownRow, flags: CardFlag[]) => flags.length === 0 || flags.includes(row.flag as CardFlag);

/** 選んだ条件に合う単語の数 */
export function countTarget(rows: BreakdownRow[], selection: StudySelection): number {
  return rows.filter((row) => inParts(row, selection.parts) && inFlags(row, selection.flags)).reduce((sum, row) => sum + amount(row, selection.needMeaning), 0);
}

/** 品詞ごとの数（フラグと意味の条件は反映し、品詞の選択は反映しない。品詞のボタンに出す数） */
export function countsByPart(rows: BreakdownRow[], selection: StudySelection): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!inFlags(row, selection.flags)) continue;
    counts[row.partOfSpeech] = (counts[row.partOfSpeech] ?? 0) + amount(row, selection.needMeaning);
  }
  return counts;
}

/** フラグごとの数（品詞と意味の条件は反映し、フラグの選択は反映しない。フラグのボタンに出す数） */
export function countsByFlag(rows: BreakdownRow[], selection: StudySelection): Record<CardFlag, number> {
  const counts: Record<CardFlag, number> = { "": 0, learned: 0, review: 0 };
  for (const row of rows) {
    if (!inParts(row, selection.parts)) continue;
    const flag = row.flag === "learned" || row.flag === "review" ? row.flag : "";
    counts[flag] += amount(row, selection.needMeaning);
  }
  return counts;
}
