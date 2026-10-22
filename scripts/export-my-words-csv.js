/**
 * 自分のスプレッドシート（preset-source/vocabook.xlsx）の単語を、アプリに取り込める CSV にする
 *
 * 使い方: node scripts/export-my-words-csv.js [xlsx のパス] [出力先 CSV]
 * 出力: preset-source/my-words.csv（リポジトリには入れない）
 * 列: 単語, 意味, 品詞, 例文, 例文の訳, メモ（アプリの「書き出し」と同じ並び）
 */
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const Papa = require("papaparse");

const ROOT = path.join(__dirname, "..");
const SOURCE = process.argv[2] || path.join(ROOT, "preset-source", "vocabook.xlsx");
const OUTPUT = process.argv[3] || path.join(ROOT, "preset-source", "my-words.csv");

/** タブ名 → アプリの品詞の日本語名。アプリの取り込みが認識できる名前にしている */
const TABS = [
  ["noun", "名詞"],
  ["verb", "動詞"],
  ["adverb", "副詞"],
  ["adjective", "形容詞"],
  ["preposition", "前置詞"],
  ["conjunction", "接続詞"],
  ["auxiliaryVerb", "助動詞"],
  ["idiom", "熟語"],
];

const cellText = (value) => {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (value.richText) return value.richText.map((part) => part.text).join("");
  if (value.text != null) return cellText(value.text);
  if (value.result != null) return String(value.result);
  if (value.hyperlink) return value.hyperlink;
  return JSON.stringify(value);
};
const clean = (value) => cellText(value).replace(/\r\n?/g, "\n").replace(/ /g, " ").trim();

(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);

  const rows = [["単語", "意味", "品詞", "例文", "例文の訳", "メモ"]];
  const counts = {};
  for (const [tab, label] of TABS) {
    const worksheet = workbook.getWorksheet(tab);
    if (!worksheet) {
      console.warn(`タブが見つかりません: ${tab}`);
      continue;
    }
    // 列は位置で決める（元のシートは A=単語, B=意味, C=例文, D=例文の訳（見出しが空欄）, E=補足）
    let first = true;
    counts[tab] = 0;
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = Array.from(row.values.slice(1), clean);
      if (first) {
        first = false; // 見出し行
        return;
      }
      if (!cells[0]) return;
      rows.push([cells[0], cells[1] ?? "", label, cells[2] ?? "", cells[3] ?? "", cells[4] ?? ""]);
      counts[tab]++;
    });
  }

  fs.writeFileSync(OUTPUT, "﻿" + Papa.unparse(rows, { newline: "\r\n" }));
  console.log(`${rows.length - 1} 件を ${path.relative(ROOT, OUTPUT)} に書き出しました`);
  console.log(JSON.stringify(counts));
})();
