import { countsByFlag, countsByPart, countTarget, decodeDirection, decodeFlags, encodeFlags, type BreakdownRow } from "../studyRange";

const rows: BreakdownRow[] = [
  { partOfSpeech: "noun", flag: "", count: 10, withMeaning: 9 },
  { partOfSpeech: "noun", flag: "learned", count: 5, withMeaning: 5 },
  { partOfSpeech: "verb", flag: "", count: 7, withMeaning: 7 },
  { partOfSpeech: "verb", flag: "review", count: 3, withMeaning: 2 },
  { partOfSpeech: "", flag: "", count: 2, withMeaning: 0 },
];
const all = { parts: [], flags: [], needMeaning: false };

describe("学習画面への、条件の受け渡し", () => {
  it("フラグは、未設定を none にして、往復できる。知らない値と重複は無視する", () => {
    expect(encodeFlags(["", "review"])).toBe("none,review");
    expect(decodeFlags("none,review")).toEqual(["", "review"]);
    expect(decodeFlags("")).toEqual([]);
    expect(decodeFlags(undefined)).toEqual([]);
    expect(decodeFlags("learned,learned,ほか,review")).toEqual(["learned", "review"]);
  });

  it("出題の向きは、知らない値なら、英語→日本語", () => {
    expect(decodeDirection("ja-en")).toBe("ja-en");
    expect(decodeDirection("listen")).toBe("listen");
    expect(decodeDirection("en-ja")).toBe("en-ja");
    expect(decodeDirection("ほか")).toBe("en-ja");
    expect(decodeDirection(undefined)).toBe("en-ja");
  });
});

describe("学習の範囲の件数", () => {
  it("条件なしなら、すべての単語（品詞が未設定のものも）の数", () => {
    expect(countTarget(rows, all)).toBe(27);
  });

  it("品詞だけ・フラグだけ・両方で絞ると、その組み合わせの数", () => {
    expect(countTarget(rows, { ...all, parts: ["noun"] })).toBe(15);
    expect(countTarget(rows, { ...all, flags: ["review"] })).toBe(3);
    expect(countTarget(rows, { ...all, parts: ["noun", "verb"], flags: ["", "review"] })).toBe(20);
    // 品詞を選ぶと、品詞が未設定の単語は含まれない（出題でも含まれない）
    expect(countTarget(rows, { ...all, parts: ["noun", "verb"] })).toBe(25);
  });

  it("意味のある単語だけ数える（日本語を見て英語を答える出題）", () => {
    expect(countTarget(rows, { ...all, needMeaning: true })).toBe(23);
    expect(countTarget(rows, { parts: ["verb"], flags: ["review"], needMeaning: true })).toBe(2);
  });

  it("品詞ごとの数は、フラグの条件を反映し、品詞の選択は反映しない", () => {
    expect(countsByPart(rows, all)).toEqual({ noun: 15, verb: 10, "": 2 });
    expect(countsByPart(rows, { ...all, flags: ["review"] })).toEqual({ verb: 3 });
    expect(countsByPart(rows, { parts: ["noun"], flags: ["learned"], needMeaning: false })).toEqual({ noun: 5 });
  });

  it("フラグごとの数は、品詞の条件を反映し、フラグの選択は反映しない", () => {
    expect(countsByFlag(rows, all)).toEqual({ "": 19, learned: 5, review: 3 });
    expect(countsByFlag(rows, { ...all, parts: ["verb"] })).toEqual({ "": 7, learned: 0, review: 3 });
    expect(countsByFlag(rows, { parts: [], flags: ["learned"], needMeaning: true })).toEqual({ "": 16, learned: 5, review: 2 });
  });
});
