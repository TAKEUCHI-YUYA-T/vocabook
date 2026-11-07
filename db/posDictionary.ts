import { buildInflections, inflectedPartOfSpeech, suggestBaseForms, type BaseFormSuggestion, type Inflections, type InflectionData } from "./lemma";
import { buildPosDictionary, guessPartOfSpeech, type PosDictionary, type PosDictionaryData } from "./partOfSpeech";
import { FUNCTION_WORD_LIST, spellingProblems, suggestSpelling } from "./spelling";
import type { PartOfSpeech } from "./types";

let dictionary: PosDictionary | null = null;
let suggestionPool: string[] | null = null;
let inflections: Inflections | null = null;

/** 辞書は大きいので、最初に使うときに読み込む（アプリの起動を遅くしない） */
function loadDictionary(): PosDictionary {
  if (!dictionary) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: PosDictionaryData = require("../assets/dictionary/pos.json");
    dictionary = buildPosDictionary(data);
  }
  return dictionary;
}

/** 不規則な変化の表（went → go など）。最初に使うときに読み込む */
function loadInflections(): Inflections {
  if (!inflections) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: InflectionData = require("../assets/dictionary/inflections.json");
    inflections = buildInflections(data);
  }
  return inflections;
}

/** アプリに同梱した品詞の辞書（約8万語）で、品詞を推定する。辞書にない不規則な形（went など）は、変化表で補う */
export function guessPartOfSpeechOnDevice(term: string): PartOfSpeech | null {
  const guessed = guessPartOfSpeech(term, loadDictionary());
  if (guessed) return guessed;
  try {
    return inflectedPartOfSpeech(term, loadInflections());
  } catch (error) {
    console.warn("[lemma] 変化の表を読み込めませんでした:", error);
    return null;
  }
}

/** 原形の候補（過去形・過去分詞・複数形・-ing 形・三単現）。読み込めなくても、例外にしない（空を返す） */
export function suggestBaseFormsOnDevice(term: string): BaseFormSuggestion[] {
  try {
    return suggestBaseForms(term, loadDictionary(), loadInflections());
  } catch (error) {
    console.warn("[lemma] 原形の候補を調べられませんでした:", error);
    return [];
  }
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
