import fs from "fs";
import path from "path";

// scripts/ は、Node で動かす JavaScript（型なし）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { formatEntries, formatTips, parseEntries, parseTips } = require("../../scripts/markdown-data");

const ROOT = path.join(__dirname, "..", "..");
const read = (...parts: string[]) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const LABELS = { 意味: "meaning", 例文: "example", メモ: "note" };
const FIELDS = [
  ["meaning", "意味"],
  ["example", "例文"],
  ["note", "メモ"],
];

describe("Markdown の読み書き（項目つきの一覧）", () => {
  it("複数行の値・値の中の空行・コロン・空の項目・同じ単語の重複を、そのまま往復できる", () => {
    const entries = [
      { term: "remember", meaning: "覚えている", example: "I remember: it was 5 p.m.\n\n（空行をはさむ）\n  先頭に空白がある行" },
      { term: "remember", meaning: "忘れずに～する" },
      { term: "empty" },
    ];
    expect(parseEntries(formatEntries(entries, FIELDS, "テスト", "説明"), LABELS)).toEqual(entries);
  });

  it("単語が複数行でも、「単語の続き」として往復できる", () => {
    const entries = [{ term: "If it were not for ～\nIf it had not been for ～", meaning: "～がなければ\n～がなかったら" }];
    const markdown = formatEntries(entries, FIELDS, "テスト");
    expect(markdown).toContain("## If it were not for ～\n");
    expect(markdown).toContain("- 単語の続き: If it had not been for ～");
    expect(parseEntries(markdown, LABELS)).toEqual(entries);
  });

  it("見出しより前の説明は読み飛ばす。知らない項目や、項目の外の文章は、場所を示して例外にする", () => {
    expect(parseEntries("# 題\n説明文\n\n## a\n\n- 意味: あ\n", LABELS)).toEqual([{ term: "a", meaning: "あ" }]);
    expect(() => parseEntries("## a\n\n- 意昧: あ\n", LABELS)).toThrow("「a」に、知らない項目「意昧」があります");
    expect(() => parseEntries("## a\n\n書き忘れた文章\n", LABELS)).toThrow("「a」に、項目ではない行があります");
  });
});

describe("Markdown の読み書き（ヒント）", () => {
  it("本文の改行・空行を、そのまま往復できる", () => {
    const tips = [
      { title: "関係代名詞", body: "1行目\n\n例：He is the man who helped me.\n2行目" },
      { title: "本文なし", body: "" },
    ];
    expect(parseTips(formatTips(tips, "説明"))).toEqual(tips);
  });

  it("本文に行頭の「## 」があると、書き出しを断る（次のヒントと区別できなくなるため）", () => {
    expect(() => formatTips([{ title: "x", body: "a\n## b" }])).toThrow("行頭の「## 」");
  });
});

describe("リポジトリの Markdown と、アプリに同梱する JSON", () => {
  it("ヒント（tips.md）が、assets/presets/tips.json と一致する（違うときは node scripts/build-presets.js を実行する）", () => {
    const json = JSON.parse(read("assets", "presets", "tips.json")) as { title: string; body: string }[];
    expect(parseTips(read("presets-src", "tips.md"))).toEqual(json.map(({ title, body }) => ({ title, body })));
  });

  it("ing or to の問題（ing-or-to.md）が、assets/presets/ing-or-to.json と一致する（違うときは node scripts/build-presets.js を実行する）", () => {
    const json = JSON.parse(read("assets", "presets", "ing-or-to.json")) as Record<string, string>[];
    const markdown = parseEntries(read("presets-src", "ing-or-to.md"), { 答え: "answer", 意味: "meaning", 例文: "example", 補足: "note" });
    expect(markdown).toEqual(json.map(({ term, answer, meaning, example, note }) => JSON.parse(JSON.stringify({ term, answer, meaning, example, note }))));
  });

  it("ing or to の問題の答えは、すべて「～ing」か「to～」", () => {
    const answers = parseEntries(read("presets-src", "ing-or-to.md"), { 答え: "answer", 意味: "meaning", 例文: "example", 補足: "note" }).map((e: { answer?: string }) => e.answer);
    expect(answers.every((answer: string | undefined) => answer === "～ing" || answer === "to～")).toBe(true);
  });
});
