import { cleanCapturedText, extractSelection, looksJapanese, looksLikeSentence, MAX_CAPTURED_TERM, textFromUrlFragment } from "../capture";

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

describe("共有された URL からの取り出し（Chrome など）", () => {
  it("#:~:text= の文字を取り出し、パーセント符号化を戻す", () => {
    expect(textFromUrlFragment("https://example.com/page#:~:text=abolish")).toBe("abolish");
    expect(textFromUrlFragment("https://example.com/#:~:text=cry%20one's%20eyes%20out")).toBe("cry one's eyes out");
    expect(textFromUrlFragment("https://example.com/#:~:text=well%2Dknown")).toBe("well-known");
    expect(textFromUrlFragment("https://example.com/#:~:text=%E5%BB%83%E6%AD%A2")).toBe("廃止");
  });

  it("前後の文脈（prefix- / -suffix）を除き、範囲指定は両端を … でつなぐ", () => {
    expect(textFromUrlFragment("https://e.com/#:~:text=the%20-,apple,-%20is")).toBe("apple");
    expect(textFromUrlFragment("https://e.com/#:~:text=start,end")).toBe("start … end");
  });

  it("複数の指示があれば最初だけ読み、壊れた符号化や、指示のない URL は空にする", () => {
    expect(textFromUrlFragment("https://e.com/#:~:text=first&text=second")).toBe("first");
    expect(textFromUrlFragment("https://e.com/#:~:text=%E0%A4%A")).toBe("");
    expect(textFromUrlFragment("https://e.com/page")).toBe("");
  });
});

describe("共有された文字の取り出し", () => {
  it("URL を含まない文字は、そのまま使う", () => {
    expect(extractSelection("  abolish ")).toEqual({ term: "abolish", kind: "plain" });
  });

  it("文字と URL が一緒に届いたら、URL を除いた文字を使う", () => {
    expect(extractSelection('"abolish" https://example.com/page#:~:text=abolish')).toEqual({ term: "abolish", kind: "plain" });
    expect(extractSelection("abolish\nhttps://example.com/")).toEqual({ term: "abolish", kind: "plain" });
  });

  it("URL だけが届いたら、#:~:text= から選んだ単語を取り出す", () => {
    expect(extractSelection("https://example.com/article#:~:text=abolish")).toEqual({ term: "abolish", kind: "fragment" });
    expect(extractSelection("https://example.com/a#intro:~:text=cry%20one's%20eyes%20out")).toEqual({ term: "cry one's eyes out", kind: "fragment" });
  });

  it("単語を取り出せない URL だけの場合は、空にして、そのことが分かるようにする", () => {
    expect(extractSelection("https://example.com/article")).toEqual({ term: "", kind: "url-only" });
    expect(extractSelection("")).toEqual({ term: "", kind: "plain" });
  });
});
