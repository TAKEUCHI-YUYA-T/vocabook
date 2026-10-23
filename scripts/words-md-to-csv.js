/**
 * 単語の Markdown（presets-src/words/*.md）を、アプリの「取り込み」で読める CSV にする
 *
 * 使い方: node scripts/words-md-to-csv.js [出力する CSV のパス]
 *   省略すると、preset-source/words-from-markdown.csv に書く（アプリの「取り込み」→「ファイルを選ぶ」で読める）
 *
 * 取り込みは「追加」だけなので、すでにアプリにある単語と同じ単語・同じ意味の行は、重複として除かれる
 */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { parseEntries } = require("./markdown-data");

const ROOT = path.join(__dirname, "..");
const WORDS_DIR = path.join(ROOT, "presets-src", "words");
const OUT = process.argv[2] || path.join(ROOT, "preset-source", "words-from-markdown.csv");

/** ファイル名（品詞のキー）→ 品詞の名前。CSV の「品詞」の列に入れる */
const POS_LABELS = {
  noun: "名詞", verb: "動詞", adverb: "副詞", adjective: "形容詞", preposition: "前置詞", conjunction: "接続詞", auxiliaryVerb: "助動詞", idiom: "熟語",
};
const LABELS = { 意味: "meaning", 例文: "example", 例文の訳: "exampleTranslation", メモ: "note", "ing or to": "answer" };

const rows = [];
for (const [key, label] of Object.entries(POS_LABELS)) {
  const file = path.join(WORDS_DIR, `${key}.md`);
  if (!fs.existsSync(file)) continue;
  for (const e of parseEntries(fs.readFileSync(file, "utf8"), LABELS)) {
    rows.push([e.term, e.meaning ?? "", label, e.example ?? "", e.exampleTranslation ?? "", e.note ?? "", e.answer ?? ""]);
  }
}

// 数式として解釈されうる先頭文字（= + - @）を無害にする。アプリの書き出しと同じ処理（取り込み時に取り除かれる）
const safe = (value) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const header = ["単語", "意味", "品詞", "例文", "例文の訳", "メモ", "ing or to"];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, "﻿" + Papa.unparse([header, ...rows.map((row) => row.map(safe))], { newline: "\r\n" }));
console.log(`${rows.length} 語 → ${path.relative(ROOT, OUT)}`);
