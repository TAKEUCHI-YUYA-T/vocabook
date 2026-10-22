import type { PartOfSpeech } from "./types";

/**
 * 単語の品詞を推定する（単語を追加するときの下書き用。端末の中だけで調べ、通信しない）
 *
 * 1. 空白を含む語句は「熟語」（かっこの中の補足は除いてから判定する。例: divide (into) → divide）
 * 2. 前置詞・接続詞・助動詞は、数が限られるので、下の一覧で決める
 * 3. それ以外は、WordNet から作った辞書（scripts/build-pos-dictionary.js）の、主な品詞
 * 4. 辞書にない変化形（複数形・過去形・-ing 形など）は、元の形から推定する
 * 推定できなければ null（品詞は空のまま）
 */

/** 品詞の辞書のデータ。品詞ごとに、見出し語（英小文字）を改行区切りで並べたもの */
export type PosDictionaryData = { noun: string; verb: string; adjective: string; adverb: string };
export type PosDictionary = ReadonlyMap<string, PartOfSpeech>;

const DICTIONARY_PARTS = ["noun", "verb", "adjective", "adverb"] as const;

export function buildPosDictionary(data: PosDictionaryData): PosDictionary {
  const map = new Map<string, PartOfSpeech>();
  for (const pos of DICTIONARY_PARTS) {
    for (const word of data[pos].split("\n")) if (word) map.set(word, pos);
  }
  return map;
}

/**
 * WordNet にない品詞の語の一覧。辞書より優先する（can や will は、辞書では名詞になるため）
 * 前置詞にも接続詞にもなる語は、どちらか一方にしている（since・until は接続詞、before・after は前置詞）
 */
const CLOSED_CLASS: ReadonlyMap<string, PartOfSpeech> = new Map<string, PartOfSpeech>([
  ...words("preposition",
    "about above across after against along amid amidst among amongst around at before behind below beneath beside besides between beyond by " +
      "concerning considering despite during except excluding following for from in including inside into minus near notwithstanding of off on onto " +
      "opposite outside over past per plus regarding round through throughout to toward towards under underneath unlike up upon versus via with within without"
  ),
  ...words("conjunction", "although and because but if lest nor or providing since supposing than that though till unless until whereas whether while whilst whenever wherever"),
  ...words("auxiliaryVerb", "can could dare may might must ought shall should will would"),
]);

function words(pos: PartOfSpeech, list: string): [string, PartOfSpeech][] {
  return list.split(" ").map((word) => [word, pos]);
}

/** かっこ（全角・半角）の中の補足を取り除き、空白をそろえる */
function withoutNotes(term: string): string {
  return term.replace(/[（(][^）)]*[）)]/g, " ").replace(/\s+/g, " ").trim();
}

/** 語の形を表す書き方（~ -wise、-story など。波線や、語の頭・終わりのハイフンを含む）。熟語として扱う */
function isPattern(text: string): boolean {
  return /[~～〜]/.test(text) || /(^|\s)-|-($|\s)/.test(text);
}

/** 小文字にして、前後の記号を取り除く */
function normalize(text: string): string {
  return text.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9.]+$/g, "");
}

/** 語尾を外して、元の形の候補を作る（stopped → stop のような、子音字の重なりも外す） */
function stems(word: string, suffix: string, replacements: string[]): string[] {
  if (!word.endsWith(suffix) || word.length <= suffix.length + 1) return [];
  const root = word.slice(0, -suffix.length);
  const candidates = replacements.map((ending) => root + ending);
  if (/([b-df-hj-np-tv-z])\1$/.test(root)) candidates.push(root.slice(0, -1));
  return candidates;
}

/** 辞書にない変化形の品詞。-ed・-ing は動詞、-s は元の形の品詞 */
function guessInflected(word: string, dictionary: PosDictionary): PartOfSpeech | null {
  for (const [suffix, replacements] of [["ied", ["y"]], ["ed", ["", "e"]], ["ing", ["", "e"]]] as const) {
    if (stems(word, suffix, [...replacements]).some((stem) => dictionary.has(stem))) return "verb";
  }
  for (const [suffix, replacements] of [["ies", ["y"]], ["es", [""]], ["s", [""]]] as const) {
    for (const stem of stems(word, suffix, [...replacements])) {
      const pos = dictionary.get(stem);
      if (pos) return pos;
    }
  }
  return null;
}

export function guessPartOfSpeech(term: string, dictionary: PosDictionary): PartOfSpeech | null {
  const text = withoutNotes(term);
  if (isPattern(text)) return "idiom";
  const word = normalize(text);
  if (!word) return null;
  if (word.includes(" ")) return "idiom";
  return CLOSED_CLASS.get(word) ?? dictionary.get(word) ?? guessInflected(word, dictionary);
}
