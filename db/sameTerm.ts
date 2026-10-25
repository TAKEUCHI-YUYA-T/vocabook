import { PARTS_OF_SPEECH, type Card } from "./types";

/**
 * 同じ綴りの単語（品詞が違う単語）をまとめる処理
 * 品詞が違えば、別の単語として登録する。学習の答えの面で、同じ綴りの、ほかの品詞の意味を並べるために使う
 */

/** 同じ綴りかの判定に使う値（前後の空白と、大文字小文字は区別しない） */
export const termKey = (term: string): string => term.trim().toLowerCase();

const partOfSpeechOrder = (card: Pick<Card, "partOfSpeech">): number => {
  const index = PARTS_OF_SPEECH.findIndex((part) => part.key === card.partOfSpeech);
  return index < 0 ? PARTS_OF_SPEECH.length : index;
};

type Sortable = Pick<Card, "partOfSpeech" | "position" | "id">;

/** 品詞の並び（名詞、動詞、…、品詞なし）にする。同じ品詞は、単語帳の並び（position、id）の順 */
export function sortByPartOfSpeech<T extends Sortable>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => partOfSpeechOrder(a) - partOfSpeechOrder(b) || a.position - b.position || a.id.localeCompare(b.id));
}

/** 同じ綴りの単語を、品詞の並びでまとめる（綴り → 単語） */
export function groupByTerm(cards: readonly Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>();
  for (const card of sortByPartOfSpeech(cards)) {
    const key = termKey(card.term);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return groups;
}

/** その単語と、同じ綴りの単語すべて（その単語を含む。品詞の並び）。ほかになければ、その単語だけ */
export function sameTermCards(card: Card, groups: ReadonlyMap<string, Card[]>): Card[] {
  return groups.get(termKey(card.term)) ?? [card];
}

/**
 * 答えの面に出す「ほかの品詞」: 同じ綴りの、ほかの単語のうち、意味のあるもの（品詞の並び）
 */
export function otherPartsOfSpeech(card: Card, groups: ReadonlyMap<string, Card[]>): Card[] {
  return sameTermCards(card, groups).filter((other) => other.id !== card.id && other.meaning.trim() !== "");
}

/**
 * 同じ綴りの単語を、1つにする（聞き取りで、同じ音を何度も出題しないため）
 * 残すのは、品詞の並びで先頭の単語。どの単語を残すかは、いつも同じ（出題の途中で、入れ替わらない）
 */
export function oneCardPerTerm<T extends Card>(cards: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const card of sortByPartOfSpeech(cards)) {
    const key = termKey(card.term);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}
