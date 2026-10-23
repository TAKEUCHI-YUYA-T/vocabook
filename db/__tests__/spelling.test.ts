import { buildPosDictionary } from "../partOfSpeech";
import { editDistance, spellingProblems, suggestSpelling } from "../spelling";

// テスト用の小さな辞書（本物は assets/dictionary/pos.json）
const dictionary = buildPosDictionary({
  noun: "beverage\ncommittee\nindustry\ntransportation\nbeverages\nhour\nlist",
  verb: "abolish\nstop\nhandle\nstudy",
  adjective: "happy\nagricultural",
  adverb: "nevertheless\nprobably",
});
const problems = (term: string) => spellingProblems(term, dictionary);

describe("綴りの確認", () => {
  it("辞書にある語・変化形・前置詞などは、問題なし", () => {
    expect(problems("abolish")).toEqual([]);
    expect(problems("Abolished")).toEqual([]); // 大文字・語尾の変化
    expect(problems("beverages")).toEqual([]);
    expect(problems("studies")).toEqual([]);
    expect(problems("despite")).toEqual([]);
    expect(problems("happily")).toEqual([]); // 派生語（-ily）
    expect(problems("listing")).toEqual([]);
  });

  it("辞書にない語は、綴りミスの疑いとして、出てきた順に返す（重複は1回）", () => {
    expect(problems("beverge")).toEqual(["beverge"]);
    expect(problems("comittee of industri")).toEqual(["comittee", "industri"]);
    expect(problems("beverge beverge")).toEqual(["beverge"]);
  });

  it("かっこの補足・～を含む表現・短い語・数字・記号は、確認しない。所有の 's は外す", () => {
    expect(problems("divide (intoo)")).toEqual(["divide"]); // 本体の divide は辞書にない（テスト用の辞書）
    expect(problems("abolish（xyzzy）")).toEqual([]);
    expect(problems("avoid ～ing")).toEqual([]);
    expect(problems("be to do")).toEqual([]);
    expect(problems("beverage's")).toEqual([]); // 所有の 's は外して確認する
    expect(problems("beverge's")).toEqual(["beverge"]);
    expect(problems("the had how your what")).toEqual([]); // 辞書にない基本の語（冠詞・代名詞・疑問詞など）
    expect(problems("don't")).toEqual([]); // 短縮形は確認しない
    expect(problems("2020 p.p.")).toEqual([]);
    expect(problems("")).toEqual([]);
  });

  it("ハイフンでつないだ語は、部分ごとに確認する。つなげて書く決まった語は、問題なし", () => {
    expect(problems("long-held")).toEqual(["long", "held"]);
    expect(problems("happy-abolish")).toEqual([]);
    expect(problems("something cannot oneself")).toEqual([]);
  });
});

describe("綴りの候補", () => {
  const pool = ["beverage", "emerge", "reverse", "committee", "committed", "industry", "transportation", "executive", "elective"];

  it("編集距離は、1文字の入れ替え・追加・削除の回数。上限を超えたら打ち切る", () => {
    expect(editDistance("beverge", "beverage")).toBe(1);
    expect(editDistance("comittee", "committee")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("abc", "xyz")).toBe(3);
    expect(editDistance("short", "extremelylong")).toBe(3);
  });

  it("近い順に、辞書にある語を返す。距離が同じなら、語頭が同じものを先にする", () => {
    expect(suggestSpelling("beverge", pool)[0]).toBe("beverage");
    expect(suggestSpelling("comittee", pool)).toEqual(["committee", "committed"]);
    expect(suggestSpelling("futher", ["father", "further", "feather"])).toEqual(["further", "father", "feather"]); // 距離が同じなら、文字が抜けた形を先に
    expect(suggestSpelling("tranceportation", pool)).toEqual(["transportation"]);
    expect(suggestSpelling("exective", pool)[0]).toBe("executive");
  });

  it("近い語がなければ、空。個数は limit まで", () => {
    expect(suggestSpelling("zzzzzz", pool)).toEqual([]);
    expect(suggestSpelling("beverge", pool, 1)).toHaveLength(1);
  });
});
