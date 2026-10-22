import { cleanCapturedText, looksJapanese, looksLikeSentence, MAX_CAPTURED_TERM } from "../capture";

describe("選んだ文字の整形", () => {
  it("前後の空白・句読点・引用符を取り除き、中の改行や空白を1つにまとめる", () => {
    expect(cleanCapturedText("  apple  ")).toBe("apple");
    expect(cleanCapturedText('"apple".')).toBe("apple");
    expect(cleanCapturedText("“abolish,”")).toBe("abolish");
    expect(cleanCapturedText("cry\none's\t eyes   out")).toBe("cry one's eyes out");
    expect(cleanCapturedText("（廃止）")).toBe("廃止");
  });

  it("単語の途中にある記号は残す（アポストロフィやハイフン）", () => {
    expect(cleanCapturedText("one's")).toBe("one's");
    expect(cleanCapturedText("well-known")).toBe("well-known");
    expect(cleanCapturedText("e.g. apple")).toBe("e.g. apple");
  });

  it("制御文字や、目に見えない文字（ゼロ幅スペースなど）を除く", () => {
    expect(cleanCapturedText("ap​ple")).toBe("apple");
    expect(cleanCapturedText("‮apple‬")).toBe("apple");
    expect(cleanCapturedText("app\u0000le\u0007")).toBe("apple");
    expect(cleanCapturedText("﻿apple")).toBe("apple");
  });

  it("空・記号だけの入力は空文字にする", () => {
    expect(cleanCapturedText("")).toBe("");
    expect(cleanCapturedText("   \n\t ")).toBe("");
    expect(cleanCapturedText("...!?")).toBe("");
  });

  it("長すぎる入力は、上限で切る", () => {
    const result = cleanCapturedText("word ".repeat(500));
    expect(result.length).toBeLessThanOrEqual(MAX_CAPTURED_TERM);
    expect(result.startsWith("word word")).toBe(true);
  });
});

describe("文字の種類の判定", () => {
  it("日本語を含むかを判定する", () => {
    expect(looksJapanese("りんご")).toBe(true);
    expect(looksJapanese("apple りんご")).toBe(true);
    expect(looksJapanese("漢字")).toBe(true);
    expect(looksJapanese("apple")).toBe(false);
  });

  it("6語以上なら、文として扱う", () => {
    expect(looksLikeSentence("cry one's eyes out")).toBe(false);
    expect(looksLikeSentence("He said that he would come back soon")).toBe(true);
  });
});
