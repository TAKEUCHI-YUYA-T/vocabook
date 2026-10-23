import { isKnownWord, type PosDictionary } from "./partOfSpeech";

/**
 * 綴りの確認（端末の中の辞書だけで動く。通信も費用もかからない）
 * 品詞の辞書（WordNet 由来の約8万語）にない語を、綴りミスの疑いとして返す
 * 固有名詞・専門用語・新しい語は、辞書にないことがあるので、「疑い」として知らせるだけにする（登録は止めない）
 */

/** 辞書（WordNet）には載っていない基本の語（冠詞・代名詞・助動詞・疑問詞など）。綴りミスではない */
const FUNCTION_WORDS =
  "the and but for nor yet not has had have having was were been being are did does done his her its our their your who whom whose which what when where why how " +
  "this that these those them they you she him his hers ours theirs yours mine one ones all any some each every both either neither such more most much many few less least " +
  "other another same own very too also just only even still ever never already again here there now then than because since while though although unless until whether " +
  "can could may might must shall should will would let get got gets say said says made makes make go goes went gone come came comes yes eke";

/** 基本の語の一覧（綴りの候補にも使う。辞書にない until のような語も、候補に出すため） */
export const FUNCTION_WORD_LIST: readonly string[] = FUNCTION_WORDS.split(" ");

/** 辞書にはないが、綴りミスではない語（1語としてつなげて書く語など） */
const ALLOWED = new Set([
  ...FUNCTION_WORDS.split(" "),
  "cannot", "something", "someone", "somebody", "somewhere", "anyone", "anything", "anybody", "anywhere", "everyone", "everything", "everybody",
  "nobody", "nothing", "nowhere", "oneself", "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves",
  "whatever", "whenever", "wherever", "whoever", "however", "okay", "unsee", "e-mail", "email", "online", "offline", "website",
]);

/** 語尾を外した形の候補（-ly・-er・-est・-ness など。辞書に載っていない派生語を見逃さないため） */
function derivedStems(word: string): string[] {
  const out: string[] = [];
  const add = (suffix: string, endings: string[]) => {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) for (const ending of endings) out.push(word.slice(0, -suffix.length) + ending);
  };
  add("ly", [""]);
  add("ily", ["y"]);
  add("er", ["", "e"]);
  add("ers", ["", "e"]);
  add("est", ["", "e"]);
  add("ier", ["y"]);
  add("iest", ["y"]);
  add("ness", [""]);
  add("iness", ["y"]);
  add("ment", [""]);
  add("able", ["", "e"]);
  return out;
}

const isKnown = (word: string, dictionary: PosDictionary) =>
  ALLOWED.has(word) || isKnownWord(word, dictionary) || derivedStems(word).some((stem) => isKnownWord(stem, dictionary));

/** 単語の中の、確認する語（かっこの補足と、記号・数字を含む語は除く。ハイフンでつないだ語は、部分ごとに分ける） */
function tokensToCheck(term: string): string[] {
  const text = term.replace(/[（(][^）)]*[）)]/g, " ");
  // 「～」「…」を含む語や、頭・終わりがハイフンの語は、語の形を表す書き方なので、確認しない
  if (/[～〜~…]/.test(text)) return [];
  const tokens: string[] = [];
  for (const raw of text.split(/[\s\-‐–—]+/)) {
    // 所有の 's（one's）は外す。don't・I'm のような短縮形は、確認しない
    const word = raw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "").replace(/['’]s$/, "");
    if (word.length >= 3 && /^[a-z]+$/.test(word)) tokens.push(word);
  }
  return [...new Set(tokens)];
}

/** 辞書にない語（綴りミスの疑い）を、出てきた順に返す。なければ空 */
export function spellingProblems(term: string, dictionary: PosDictionary): string[] {
  return tokensToCheck(term).filter((word) => !isKnown(word, dictionary));
}

const MAX_DISTANCE = 2;

/** 2つの語の、編集距離（1文字の入れ替え・追加・削除の回数）。max を超えたら、max + 1 を返して打ち切る */
export function editDistance(a: string, b: string, max: number = MAX_DISTANCE): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * 近い綴りの、辞書にある語（pool は辞書の語の一覧）を、近い順に limit 個返す
 * 距離が同じなら、先頭の文字が同じもの（打ち間違いは、語頭が合っていることが多い）、次に文字が抜けた形のものを先にする
 */
export function suggestSpelling(word: string, pool: readonly string[], limit = 3): string[] {
  const found: { word: string; distance: number; sameInitial: number; lengthGap: number }[] = [];
  for (const candidate of pool) {
    if (Math.abs(candidate.length - word.length) > MAX_DISTANCE) continue;
    const distance = editDistance(word, candidate);
    if (distance > MAX_DISTANCE) continue;
    found.push({ word: candidate, distance, sameInitial: candidate[0] === word[0] ? 0 : 1, lengthGap: Math.abs(candidate.length - word.length) });
  }
  // 同じ距離なら: 語頭が同じもの → 文字が抜けた形（候補のほうが長い）→ 同じ長さ → 短い形、の順（打ち間違いは、文字の抜けが多い）
  const shape = (candidate: string) => (candidate.length > word.length ? 0 : candidate.length === word.length ? 1 : 2);
  found.sort((x, y) => x.distance - y.distance || x.sameInitial - y.sameInitial || shape(x.word) - shape(y.word) || x.lengthGap - y.lengthGap || x.word.localeCompare(y.word));
  return found.slice(0, limit).map((f) => f.word);
}
