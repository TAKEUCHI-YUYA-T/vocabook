import type { DefaultWord } from "./presets";
import type { CardInput } from "./types";

/**
 * 既定の単語のうち、いまの単語帳にまだない単語を探す（単語帳の「既定の単語を追加」で使う）
 * 「同じ単語（大文字小文字は区別しない）・同じ品詞」の単語が、すでにあれば、ない単語とはしない
 * 自分で直した単語（意味を変えたものなど）を、重ねて追加しないため、意味や例文は比べない
 */
export function findMissingDefaultWords(
  existing: readonly { term: string; partOfSpeech: string | null }[],
  words: readonly DefaultWord[]
): DefaultWord[] {
  const key = (term: string, partOfSpeech: string | null) => `${term.trim().toLowerCase()}|${partOfSpeech ?? ""}`;
  const have = new Set(existing.map((card) => key(card.term, card.partOfSpeech)));
  return words.filter((word) => !have.has(key(word.term, word.partOfSpeech)));
}

/** 既定の単語を、単語帳に追加するための入力にする */
export const defaultWordToInput = (word: DefaultWord): CardInput => ({
  term: word.term,
  meaning: word.meaning,
  partOfSpeech: word.partOfSpeech,
  example: word.example ?? "",
  exampleTranslation: word.exampleTranslation ?? "",
  note: word.note ?? "",
});
