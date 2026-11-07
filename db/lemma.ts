import { isClosedClassWord, type PosDictionary } from "./partOfSpeech";

/**
 * 原形の候補（過去形・過去分詞・複数形・-ing 形・三単現の -s を、元の形（原形）に戻す）
 * 単語を追加するときに、「原形は handle」のようなボタンを出すために使う。自動では直さない
 *
 * - 不規則な変化（went → go、children → child）は、WordNet の変化表（scripts/build-pos-dictionary.js が作る inflections.json）で調べる
 * - 規則的な変化は、語尾（-s・-es・-ies・-ed・-ing）を外して、辞書にある名詞・動詞かを確かめる
 * - 前置詞・接続詞・助動詞、熟語、比較級・最上級は、対象にしない
 */

/** 変化の表のデータ。形と原形を「形 原形 [原形...]」の行で並べたものと、主な品詞以外でも名詞・動詞になる語の一覧 */
export type InflectionData = { nounExceptions: string; verbExceptions: string; alsoNoun: string; alsoVerb: string };

export type Inflections = {
  nounExceptions: ReadonlyMap<string, string[]>;
  verbExceptions: ReadonlyMap<string, string[]>;
  alsoNoun: ReadonlySet<string>;
  alsoVerb: ReadonlySet<string>;
};

function parseExceptions(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    const [form, ...lemmas] = line.split(" ");
    if (form && lemmas.length > 0) map.set(form, lemmas);
  }
  return map;
}

const parseList = (text: string): Set<string> => new Set(text.split("\n").filter(Boolean));

export function buildInflections(data: InflectionData): Inflections {
  return {
    nounExceptions: parseExceptions(data.nounExceptions),
    verbExceptions: parseExceptions(data.verbExceptions),
    alsoNoun: parseList(data.alsoNoun),
    alsoVerb: parseList(data.alsoVerb),
  };
}

/** 主な不規則動詞の、原形・過去形・過去分詞（過去形と過去分詞を、見分けて表示するため） */
const IRREGULAR_VERBS =
  "arise arose arisen|awake awoke awoken|be was,were been|bear bore born,borne|beat beat beaten|become became become|begin began begun|bend bent bent|bet bet bet|bind bound bound|bite bit bitten|bleed bled bled|blow blew blown|break broke broken|breed bred bred|bring brought brought|build built built|burn burnt,burned burnt,burned|buy bought bought|catch caught caught|choose chose chosen|cling clung clung|come came come|cost cost cost|creep crept crept|cut cut cut|deal dealt dealt|dig dug dug|do did done|draw drew drawn|dream dreamt,dreamed dreamt,dreamed|drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed fed|feel felt felt|fight fought fought|find found found|flee fled fled|fly flew flown|forbid forbade forbidden|forget forgot forgotten|forgive forgave forgiven|freeze froze frozen|get got gotten,got|give gave given|go went gone|grind ground ground|grow grew grown|hang hung hung|have had had|hear heard heard|hide hid hidden|hit hit hit|hold held held|hurt hurt hurt|keep kept kept|kneel knelt knelt|know knew known|lay laid laid|lead led led|leave left left|lend lent lent|let let let|lie lay lain|light lit lit|lose lost lost|make made made|mean meant meant|meet met met|pay paid paid|put put put|quit quit quit|read read read|ride rode ridden|ring rang rung|rise rose risen|run ran run|say said said|see saw seen|seek sought sought|sell sold sold|send sent sent|set set set|shake shook shaken|shine shone shone|shoot shot shot|show showed shown|shrink shrank shrunk|shut shut shut|sing sang sung|sink sank sunk|sit sat sat|sleep slept slept|slide slid slid|speak spoke spoken|spend spent spent|spin spun spun|split split split|spread spread spread|spring sprang sprung|stand stood stood|steal stole stolen|stick stuck stuck|sting stung stung|strike struck struck|swear swore sworn|sweep swept swept|swim swam swum|swing swung swung|take took taken|teach taught taught|tear tore torn|tell told told|think thought thought|throw threw thrown|understand understood understood|wake woke woken|wear wore worn|weave wove woven|weep wept wept|win won won|wind wound wound|withdraw withdrew withdrawn|write wrote written";

type IrregularForms = { past: ReadonlySet<string>; participle: ReadonlySet<string> };
const irregular = new Map<string, IrregularForms>();
for (const entry of IRREGULAR_VERBS.split("|")) {
  const [lemma, past, participle] = entry.split(" ");
  irregular.set(lemma, { past: new Set(past.split(",")), participle: new Set(participle.split(",")) });
}

/** 不規則動詞の形の種類（過去形・過去分詞）。表にない形は「活用形」 */
function irregularKind(lemma: string, form: string): string {
  const forms = irregular.get(lemma);
  if (!forms) return "活用形";
  const past = forms.past.has(form);
  const participle = forms.participle.has(form);
  if (past && participle) return "過去形・過去分詞";
  if (past) return "過去形";
  if (participle) return "過去分詞";
  return "活用形";
}

export type BaseFormSuggestion = {
  /** 入力された語（小文字）。画面で、この語を原形に置き換える */
  word: string;
  /** 原形 */
  lemma: string;
  /** 形の種類（「過去形」「-ing 形」「複数形」など） */
  kind: string;
  /** その形自体も辞書の見出し語か（studying は名詞でもある、など）。そのときは、その形の品詞と意味を先に出す */
  isHeadword: boolean;
};

/** 候補を出す、最大の数（原形が複数ある語は、2つまで） */
const MAX_SUGGESTIONS = 2;

const NOUN_RULES: readonly [string, string][] = [
  ["ies", "y"],
  ["ses", "s"],
  ["xes", "x"],
  ["zes", "z"],
  ["ches", "ch"],
  ["shes", "sh"],
  ["men", "man"],
  ["s", ""],
];
const VERB_RULES: readonly [string, string, string][] = [
  ["ies", "y", "三単現"],
  ["es", "", "三単現"],
  ["s", "", "三単現"],
  ["ied", "y", "過去形・過去分詞"],
  ["ed", "e", "過去形・過去分詞"],
  ["ed", "", "過去形・過去分詞"],
  ["ing", "e", "-ing 形"],
  ["ing", "", "-ing 形"],
];

/** 候補を出す語の形。空白を含む語句（熟語）・記号や数字を含む語・短すぎる語は、対象外（null） */
function candidateWord(term: string): string | null {
  const text = term.replace(/[（(][^）)]*[）)]/g, " ").trim().toLowerCase();
  return /^[a-z]{3,}$/.test(text) ? text : null;
}

/** 語尾の前の、子音字の重なり（stopped → stop、running → run）を外した形 */
const undoubled = (root: string): string | null => (/([b-df-hj-np-tv-z])\1$/.test(root) ? root.slice(0, -1) : null);

export function suggestBaseForms(term: string, dictionary: PosDictionary, inflections: Inflections): BaseFormSuggestion[] {
  const word = candidateWord(term);
  if (!word || isClosedClassWord(word)) return [];

  const isNoun = (lemma: string) => dictionary.get(lemma) === "noun" || inflections.alsoNoun.has(lemma);
  const isVerb = (lemma: string) => dictionary.get(lemma) === "verb" || inflections.alsoVerb.has(lemma);

  // 原形ごとに、形の種類を集める（同じ原形が、複数の種類に当たるときは、まとめる）
  const found = new Map<string, string[]>();
  const add = (lemma: string, kind: string) => {
    if (lemma === word || lemma.length < 2) return;
    const kinds = found.get(lemma) ?? [];
    if (!kinds.includes(kind)) kinds.push(kind);
    found.set(lemma, kinds);
  };

  // 1. 不規則な変化（WordNet の変化表）
  for (const lemma of inflections.verbExceptions.get(word) ?? []) {
    if (dictionary.has(lemma)) add(lemma, word.endsWith("ing") ? "-ing 形" : irregularKind(lemma, word));
  }
  for (const lemma of inflections.nounExceptions.get(word) ?? []) {
    if (dictionary.has(lemma)) add(lemma, "複数形");
  }

  // 2. 規則的な変化（語尾を外して、辞書にある名詞・動詞かを確かめる）
  for (const [suffix, ending] of NOUN_RULES) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 1) continue;
    const lemma = word.slice(0, -suffix.length) + ending;
    if (isNoun(lemma)) add(lemma, "複数形");
  }
  for (const [suffix, ending, kind] of VERB_RULES) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 2) continue;
    const root = word.slice(0, -suffix.length);
    // -ed・-ing を外して e を足す形（handled → handle）は、語幹が e で終わるとき（seed → see）は誤りなので除く
    if (ending === "e" && root.endsWith("e")) continue;
    const lemmas = [root + ending];
    const single = undoubled(root);
    if (single && ending === "") lemmas.push(single);
    for (const lemma of lemmas) if (isVerb(lemma)) add(lemma, kind);
  }

  const isHeadword = dictionary.has(word);
  return [...found.entries()]
    // 見出し語でもある形で、形の種類が分からないもの（rent → rend など）は、誤りの可能性が高いので出さない
    .filter(([, kinds]) => !(isHeadword && kinds.every((kind) => kind === "活用形")))
    .slice(0, MAX_SUGGESTIONS)
    .map(([lemma, kinds]) => ({ word, lemma, kind: kinds.join("・"), isHeadword }));
}

/**
 * 辞書にない不規則な形（went など）の品詞。品詞の推定で、辞書にない語を、変化表で補う
 * 動詞の変化表にあれば動詞、名詞の変化表にあれば名詞
 */
export function inflectedPartOfSpeech(term: string, inflections: Inflections): "verb" | "noun" | null {
  const word = candidateWord(term);
  if (!word) return null;
  if (inflections.verbExceptions.has(word)) return "verb";
  if (inflections.nounExceptions.has(word)) return "noun";
  return null;
}
