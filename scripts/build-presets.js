/**
 * preset-source/vocabook.xlsx から、アプリに同梱するプリセット JSON を作る
 *
 * 使い方: node scripts/build-presets.js [xlsx のパス]
 * 単語のタブは同梱しない（単語帳はユーザーが自分で作る）
 *
 * 出力:
 *   assets/presets/ing-or-to.json  ing or to の問題
 *   assets/presets/tips.json       ヒント（reference シートの title・reference 列だけ。URL は使わない）
 *   assets/presets/version.json    内容から計算した版（変更の検出用）
 *   preset-source/report.txt       崩れた行・要確認の行の報告書（公開しない）
 *
 * 列は位置ではなく見出し名で探し、列の並びが変わっても壊れないようにしている
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const ROOT = path.join(__dirname, "..");
const SOURCE = process.argv[2] || path.join(ROOT, "preset-source", "vocabook.xlsx");
const OUT_DIR = path.join(ROOT, "assets", "presets");
const REPORT = path.join(ROOT, "preset-source", "report.txt");

/** 単語のタブ。アプリには同梱しないので読み飛ばす（想定外のタブとしても報告しない） */
const WORD_TABS = ["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];

const report = [];
const warn = (message) => report.push(message);

/** セルの値を文字列にする（リッチテキストやリンクも文字にする） */
const cellText = (value) => {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (value.richText) return value.richText.map((part) => part.text).join("");
  if (value.text != null) return cellText(value.text);
  if (value.result != null) return String(value.result);
  if (value.hyperlink) return value.hyperlink;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

/** 前後の空白・改行を取り除き、改行コードをそろえる */
const clean = (value) => cellText(value).replace(/\r\n?/g, "\n").replace(/ /g, " ").trim();

/** シートの全行を、文字列の配列として取り出す（空行は除く） */
const readRows = (worksheet) => {
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    rows.push({ rowNumber, cells: Array.from(row.values.slice(1), cleanKeepRaw) });
  });
  return rows;
};

/** 報告用に、前後の空白を取る前の値も残す */
function cleanKeepRaw(value) {
  const raw = cellText(value).replace(/\r\n?/g, "\n");
  return { raw, text: clean(value) };
}

/** 見出し行から、項目名 → 列番号 の対応を作る */
const mapColumns = (headerCells, columns) => {
  const header = headerCells.map((cell) => cell.text.toLowerCase().replace(/\s+/g, ""));
  const mapping = {};
  for (const [field, aliases] of Object.entries(columns)) {
    const index = header.findIndex((name) => aliases.includes(name));
    if (index >= 0) mapping[field] = index;
  }
  return mapping;
};

/** 重複しない ID を作る（品詞 + 単語。同じ単語が2回出たら連番を付ける） */
const makeIdFactory = () => {
  const used = new Map();
  return (prefix, term) => {
    const base = `${prefix}:${term.toLowerCase().replace(/\s+/g, "-")}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  };
};

const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== "" && v != null));

const buildIngOrTo = (workbook) => {
  const worksheet = workbook.getWorksheet("ingOrTo");
  if (!worksheet) {
    warn("[ingOrTo] タブが見つかりません");
    return [];
  }
  const rows = readRows(worksheet);
  const mapping = mapColumns(rows[0].cells, {
    term: ["words", "word"],
    answer: ["ingorto", "ing/to"],
    meaning: ["meaning", "意味"],
    example: ["example", "例文"],
    note: ["supplement", "note", "補足"],
  });
  const makeId = makeIdFactory();
  const items = [];
  const answers = new Set();
  for (const { rowNumber, cells } of rows.slice(1)) {
    const get = (field) => (mapping[field] != null ? (cells[mapping[field]]?.text ?? "") : "");
    const term = get("term");
    if (!term) continue;
    const answer = get("answer");
    answers.add(answer);
    if (!answer) warn(`[ingOrTo] ${rowNumber}行目: 「${term}」に答え（ing or to）がありません`);
    items.push(compact({ id: makeId("ingOrTo", term), term, answer, meaning: get("meaning"), example: get("example"), note: get("note") }));
  }
  warn(`[ingOrTo] 答えの値の種類: ${[...answers].map((a) => `「${a}」`).join(" ")}`);
  return items;
};

const buildTips = (workbook) => {
  const worksheet = workbook.getWorksheet("reference");
  if (!worksheet) {
    warn("[reference] タブが見つかりません");
    return [];
  }
  const rows = readRows(worksheet);
  // ヒントに使うのは、見出し「title」「reference」の2列だけ（URL の列は読まない）
  const mapping = mapColumns(rows[0].cells, { title: ["title", "タイトル"], body: ["reference", "本文", "内容"] });
  if (mapping.title == null || mapping.body == null) warn("[reference] 見出し「title」「reference」が見つかりません");
  const makeId = makeIdFactory();
  const tips = [];
  for (const { rowNumber, cells } of rows.slice(1)) {
    const get = (field) => (mapping[field] != null ? (cells[mapping[field]]?.text ?? "") : "");
    const title = get("title");
    const body = get("body");
    if (!title && !body) continue;
    // タイトルが空でも、本文があれば登録する（ホームでは本文だけを表示する）
    if (!title) warn(`[reference] ${rowNumber}行目: タイトルが空です（本文だけを登録しました: 「${body.slice(0, 30)}」）`);
    // タイトルが空でも、title の項目は必ず残す（アプリの DB は title が必須）
    tips.push({ id: makeId("tip", title || body.slice(0, 20)), title, body });
  }
  return tips;
};

(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const known = new Set([...WORD_TABS, "ingOrTo", "reference"]);
  for (const worksheet of workbook.worksheets) {
    if (!known.has(worksheet.name)) warn(`[${worksheet.name}] 想定外のタブです（読み飛ばしました）`);
  }

  const ingOrTo = buildIngOrTo(workbook);
  const tips = buildTips(workbook);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 1) + "\n");
  write("ing-or-to.json", ingOrTo);
  write("tips.json", tips);
  // 内容が変わったときだけ変わる版。アプリはこの値で、プリセットを DB に入れ直すか決める
  const version = crypto.createHash("sha1").update(JSON.stringify([ingOrTo, tips])).digest("hex").slice(0, 12);
  write("version.json", { version });

  const summary = `ing or to ${ingOrTo.length} 問、ヒント ${tips.length} 件`;
  fs.writeFileSync(REPORT, [`# プリセット変換の報告書`, summary, "", ...report.map((line) => `- ${line}`), ""].join("\n"));
  console.log(summary);
  console.log(`報告 ${report.length} 件 → ${path.relative(ROOT, REPORT)}`);
})();
