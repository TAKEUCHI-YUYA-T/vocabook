import { buildPosDictionary, guessPartOfSpeech, type PosDictionary, type PosDictionaryData } from "./partOfSpeech";
import type { PartOfSpeech } from "./types";

let dictionary: PosDictionary | null = null;

/**
 * アプリに同梱した品詞の辞書（約8万語）で、品詞を推定する
 * 辞書は大きいので、最初に使うときに読み込む（アプリの起動を遅くしない）
 */
export function guessPartOfSpeechOnDevice(term: string): PartOfSpeech | null {
  if (!dictionary) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data: PosDictionaryData = require("../assets/dictionary/pos.json");
    dictionary = buildPosDictionary(data);
  }
  return guessPartOfSpeech(term, dictionary);
}
