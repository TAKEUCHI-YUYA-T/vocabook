import fs from "fs";
import path from "path";
import { buildInflections, inflectedPartOfSpeech, suggestBaseForms, type InflectionData } from "../lemma";
import { buildPosDictionary, type PosDictionaryData } from "../partOfSpeech";
import { guessPartOfSpeechOnDevice } from "../posDictionary";

const DIR = path.join(__dirname, "..", "..", "assets", "dictionary");
const dictionary = buildPosDictionary(JSON.parse(fs.readFileSync(path.join(DIR, "pos.json"), "utf8")) as PosDictionaryData);
const inflections = buildInflections(JSON.parse(fs.readFileSync(path.join(DIR, "inflections.json"), "utf8")) as InflectionData);
const suggest = (term: string) => suggestBaseForms(term, dictionary, inflections);
const lemmas = (term: string) => suggest(term).map((s) => s.lemma);

describe("原形の候補", () => {
  it("不規則な変化は、過去形と過去分詞を見分けて、原形を出す。辞書にない形は isHeadword が false", () => {
    expect(suggest("went")).toEqual([{ word: "went", lemma: "go", kind: "過去形", isHeadword: false }]);
    expect(suggest("gone")[0]).toMatchObject({ lemma: "go", kind: "過去分詞" });
    expect(suggest("saw")[0]).toMatchObject({ lemma: "see", kind: "過去形" });
    expect(suggest("found")[0]).toMatchObject({ lemma: "find", kind: "過去形・過去分詞" });
    expect(suggest("children")).toEqual([{ word: "children", lemma: "child", kind: "複数形", isHeadword: false }]);
    expect(lemmas("mice")).toEqual(["mouse"]);
    expect(lemmas("analyses")[0]).toBe("analysis"); // 不規則な変化を先に出す（analyse の三単現も、2つ目に出る）
  });

  it("規則的な変化は、語尾を外して、辞書にある名詞・動詞のときだけ出す（子音字の重なり・e の復元も）", () => {
    expect(suggest("handled")[0]).toMatchObject({ lemma: "handle", kind: "過去形・過去分詞", isHeadword: true });
    expect(lemmas("stopped")).toContain("stop");
    expect(lemmas("running")).toContain("run");
    expect(lemmas("studies")).toContain("study");
    expect(lemmas("pertains")).toEqual(["pertain"]);
    expect(lemmas("boxes")).toContain("box");
    expect(suggest("autographs")[0]).toMatchObject({ lemma: "autograph" });
  });

  it("その形自体が見出し語（別の品詞・意味がある）なら、isHeadword を true にして、候補は添える", () => {
    expect(suggest("studying")[0]).toMatchObject({ lemma: "study", kind: "-ing 形", isHeadword: true });
    expect(suggest("opening")[0]).toMatchObject({ lemma: "open", isHeadword: true });
  });

  it("-ing 形・三単現の候補を出す", () => {
    expect(suggest("streamlining")[0]).toMatchObject({ lemma: "streamline", kind: "-ing 形" });
    expect(suggest("pertains")[0]).toMatchObject({ lemma: "pertain", kind: "三単現" });
  });

  it("原形・別の語・誤りになりやすい語には、候補を出さない", () => {
    for (const word of ["go", "abolish", "concern", "seed", "bed", "this", "the", "bus", "class", "news"]) expect(lemmas(word)).not.toContain(word);
    expect(lemmas("seed")).not.toContain("see"); // seed は、see の過去形ではない
    expect(lemmas("abolish")).toEqual([]);
  });

  it("前置詞・接続詞、熟語、数字や記号を含む語は、対象外", () => {
    expect(lemmas("considering")).toEqual([]);
    expect(lemmas("concerning")).toEqual([]);
    expect(lemmas("according to")).toEqual([]);
    expect(lemmas("used to")).toEqual([]);
    expect(lemmas("go-getters")).toEqual([]);
    expect(lemmas("a1s")).toEqual([]);
    expect(lemmas("")).toEqual([]);
  });

  it("かっこの補足は無視して、大文字小文字も区別しない", () => {
    expect(lemmas("Went (past)")).toEqual(["go"]);
  });

  it("原形が2つあれば、2つまで出す", () => {
    expect(lemmas("bathing").length).toBeLessThanOrEqual(2);
  });
});

describe("辞書にない不規則な形の品詞", () => {
  it("動詞の変化表にあれば動詞、名詞の変化表にあれば名詞", () => {
    expect(inflectedPartOfSpeech("went", inflections)).toBe("verb");
    expect(inflectedPartOfSpeech("children", inflections)).toBe("noun");
    expect(inflectedPartOfSpeech("abolish", inflections)).toBeNull();
  });
});

describe("端末の辞書で、辞書にない不規則な形の品詞を補う", () => {
  it("went は動詞、children は名詞。辞書にある語は、今までどおり", () => {
    expect(guessPartOfSpeechOnDevice("went")).toBe("verb");
    expect(guessPartOfSpeechOnDevice("children")).toBe("noun");
    expect(guessPartOfSpeechOnDevice("abolish")).toBe("verb");
    expect(guessPartOfSpeechOnDevice("zzzzzz")).toBeNull();
  });
});
