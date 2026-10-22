import { buildPosDictionary, guessPartOfSpeech } from "../partOfSpeech";

// テスト用の小さな辞書（本物は assets/dictionary/pos.json）
const dictionary = buildPosDictionary({
  noun: "can\nconcern\nhandle\nautograph\nwill",
  verb: "abolish\ndivide\nstop\nstudy",
  adjective: "allergic\nspontaneous",
  adverb: "probably",
});
const guess = (term: string) => guessPartOfSpeech(term, dictionary);

describe("品詞の推定", () => {
  it("辞書にある単語は、辞書の主な品詞にする（大文字・前後の空白は無視する）", () => {
    expect(guess("abolish")).toBe("verb");
    expect(guess("  Spontaneous ")).toBe("adjective");
    expect(guess("probably")).toBe("adverb");
    expect(guess("concern")).toBe("noun");
  });

  it("空白を含む語句は熟語。ただし、かっこの中の補足は除いて判定する", () => {
    expect(guess("cry one's eyes out")).toBe("idiom");
    expect(guess("take part in")).toBe("idiom");
    expect(guess("divide (into)")).toBe("verb");
    expect(guess("allergic（to）")).toBe("adjective");
    expect(guess("look forward to (doing)")).toBe("idiom");
  });

  it("語の形を表す書き方（波線や、頭・終わりのハイフン）は熟語。語の中のハイフンは対象外", () => {
    expect(guess("~ -wise")).toBe("idiom");
    expect(guess("（数字）-story")).toBe("idiom");
    expect(guess("～ing")).toBe("idiom");
    expect(guess("e-mail")).toBeNull();
  });

  it("前置詞・接続詞・助動詞は、一覧で決める（辞書の名詞より優先する）", () => {
    expect(guess("considering")).toBe("preposition");
    expect(guess("despite")).toBe("preposition");
    expect(guess("although")).toBe("conjunction");
    expect(guess("since")).toBe("conjunction");
    expect(guess("supposing")).toBe("conjunction");
    expect(guess("can")).toBe("auxiliaryVerb");
    expect(guess("will")).toBe("auxiliaryVerb");
    expect(guess("ought")).toBe("auxiliaryVerb");
  });

  it("辞書にない変化形は、元の形から推定する（-ed・-ing は動詞、-s は元の形の品詞）", () => {
    expect(guess("handled")).toBe("verb");
    expect(guess("abolishing")).toBe("verb");
    expect(guess("stopped")).toBe("verb");
    expect(guess("studied")).toBe("verb");
    expect(guess("autographs")).toBe("noun");
    expect(guess("studies")).toBe("verb");
  });

  it("推定できなければ null（品詞は空のまま）", () => {
    expect(guess("xyzzy")).toBeNull();
    expect(guess("")).toBeNull();
    expect(guess("（数字）")).toBeNull();
    expect(guess("...")).toBeNull();
    expect(guess("s")).toBeNull();
  });
});
