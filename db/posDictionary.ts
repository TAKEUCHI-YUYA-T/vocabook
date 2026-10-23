import { buildPosDictionary, guessPartOfSpeech, type PosDictionary, type PosDictionaryData } from "./partOfSpeech";
import { FUNCTION_WORD_LIST, spellingProblems, suggestSpelling } from "./spelling";
import type { PartOfSpeech } from "./types";

let dictionary: PosDictionary | null = null;
let suggestionPool: string[] | null = null;

/** 辞書は大きいので、最初に使うときに読み込む（アプリの起動を遅くしない） */
function loadDictionary(): PosDictionary {
  if (!dictionary) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: PosDictionaryData = require("../assets/dictionary/pos.json");
    dictionary = buildPosDictionary(data);
  }
  return dictionary;
}

/** アプリに同梱した品詞の辞書（約8万語）で、品詞を推定する */
export function guessPartOfSpeechOnDevice(term: string): PartOfSpeech | null {
  return guessPartOfSpeech(term, loadDictionary());
}

/** 辞書にない語（綴りミスの疑い）を返す。辞書を読み込めなくても、例外にしない（空を返す） */
export function spellingProblemsOnDevice(term: string): string[] {
  try {
    return spellingProblems(term, loadDictionary());
  } catch (error) {
    console.warn("[spelling] 辞書を読み込めませんでした:", error);
    return [];
  }
}

/** 綴りの候補（近い綴りの、辞書にある語）を返す */
export function suggestSpellingOnDevice(word: string): string[] {
  try {
    const dict = loadDictionary();
    suggestionPool ??= Array.from(new Set([...dict.keys(), ...FUNCTION_WORD_LIST])).filter((w) => /^[a-z]+$/.test(w));
    return suggestSpelling(word, suggestionPool);
  } catch {
    return [];
  }
}
