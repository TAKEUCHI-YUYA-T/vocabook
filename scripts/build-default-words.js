/**
 * アプリの初回起動で入れる「既定の単語」の Markdown を、自分の単語（presets-src/words/*.md）から選んで作る（一度だけ使う）
 *
 * 使い方: node scripts/build-default-words.js
 * 出力: presets-src/default-words/<品詞>.md（git で管理する。以後は、この Markdown を直接直す）
 *
 * 選ぶ基準（公開して配るものとして、品質が足りない行を外す）
 *   - 意味が空の単語は外す
 *   - 品詞名そのもの（noun・verb など。表の見出し行の混入）は外す
 *   - 同じ単語・同じ品詞の重複は、意味をまとめて1件にする（例文・メモは、最初の入っているもの）
 *   - 長すぎるメモ（150字超）と、絵文字などの装飾つきのメモは、メモだけ外す（単語は残す）
 * 外した・まとめた内容は、標準出力に報告する
 */
const fs = require("fs");
const path = require("path");
const { formatEntries, parseEntries } = require("./markdown-data");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "presets-src", "words");
const OUT_DIR = path.join(ROOT, "presets-src", "default-words");

const POS = [
  ["noun", "名詞"],
  ["verb", "動詞"],
  ["adverb", "副詞"],
  ["adjective", "形容詞"],
  ["preposition", "前置詞"],
  ["conjunction", "接続詞"],
  ["auxiliaryVerb", "助動詞"],
  ["idiom", "熟語"],
];
const LABELS = { 意味: "meaning", 例文: "example", 例文の訳: "exampleTranslation", メモ: "note" };
const FIELDS = [["meaning", "意味"], ["example", "例文"], ["exampleTranslation", "例文の訳"], ["note", "メモ"]];

const POS_NAMES = new Set(["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliary verb", "auxiliaryverb", "idiom"]);
const DECORATION = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const MAX_NOTE = 150;

const report = { emptyMeaning: [], posNames: [], merged: [], notesDropped: [] };

/** 意味を、「、」で区切った要素の和にする。すでに含まれる要素は足さない */
const mergeMeanings = (a, b) => {
  const parts = (text) => text.split(/[、,]/).map((p) => p.trim()).filter(Boolean);
  const merged = [...parts(a)];
  for (const part of parts(b)) if (!merged.some((m) => m === part || m.includes(part) || part.includes(m))) merged.push(part);
  return merged.join("、");
};

fs.mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const [key, label] of POS) {
  const entries = parseEntries(fs.readFileSync(path.join(SOURCE_DIR, `${key}.md`), "utf8"), LABELS);
  const result = [];
  const index = new Map();
  for (const entry of entries) {
    if (POS_NAMES.has(entry.term.toLowerCase())) {
      report.posNames.push(`${entry.term}（${label}）`);
      continue;
    }
    if (!entry.meaning) {
      report.emptyMeaning.push(`${entry.term}（${label}）`);
      continue;
    }
    const k = entry.term.toLowerCase();
    const found = index.get(k);
    if (found) {
      found.meaning = mergeMeanings(found.meaning, entry.meaning);
      for (const field of ["example", "exampleTranslation", "note"]) found[field] ||= entry[field];
      report.merged.push(`${entry.term}（${label}）`);
      continue;
    }
    index.set(k, entry);
    result.push(entry);
  }
  for (const entry of result) {
    if (entry.note && (entry.note.length > MAX_NOTE || DECORATION.test(entry.note))) {
      report.notesDropped.push(`${entry.term}（${entry.note.length}字）`);
      delete entry.note;
    }
  }
  total += result.length;
  fs.writeFileSync(
    path.join(OUT_DIR, `${key}.md`),
    formatEntries(result, FIELDS, `${label}（${key}）`, `アプリの初回起動で、単語帳に入れる既定の単語（TOEIC 対策の範囲）。${result.length} 語。書き方は presets-src/README.md を参照。`)
  );
  console.log(`${key}.md: ${result.length} 語`);
}
console.log(`合計 ${total} 語`);
console.log(`外した（意味が空）: ${report.emptyMeaning.join("、") || "なし"}`);
console.log(`外した（品詞名そのもの）: ${report.posNames.join("、") || "なし"}`);
console.log(`重複をまとめた: ${report.merged.length} 件（${report.merged.join("、")}）`);
console.log(`メモだけ外した: ${report.notesDropped.join("、") || "なし"}`);
