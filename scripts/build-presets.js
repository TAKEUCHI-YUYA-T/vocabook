/**
 * preset-source/vocabook.xlsx から、アプリに同梱するプリセット JSON を作る
 *
 * 使い方: node scripts/build-presets.js [xlsx のパス]
 * 出力:
 *   assets/presets/words.json      品詞別の単語・熟語カード
 *   assets/presets/ing-or-to.json  ing or to の問題
 *   assets/presets/tips.json       ヒント（reference シート）
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

/** 単語シートのタブ名（= アプリでの品詞キー） */
const WORD_TABS = ["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];

/** 見出し名の別名。左がアプリ内の項目名、右が受け付ける見出し（小文字で比較） */
const WORD_COLUMNS = {
  term: ["words", "word", "term", "単語"],
  meaning: ["meaning", "意味"],
  example: ["example", "例文"],
  exampleTranslation: ["exampletranslation", "translation", "例文の訳", "訳"],
  note: ["supplement", "note", "補足", "メモ"],
};

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

const buildWords = (workbook) => {
  const words = [];
  const makeId = makeIdFactory();
  for (const tab of WORD_TABS) {
    const worksheet = workbook.getWorksheet(tab);
    if (!worksheet) {
      warn(`[${tab}] タブが見つかりません`);
      continue;
    }
    const rows = readRows(worksheet);
    const mapping = mapColumns(rows[0].cells, WORD_COLUMNS);
    // 見出しが空欄の列は、位置から「例文の訳」とみなす（元のシートの癖）
    if (mapping.exampleTranslation == null && mapping.example != null && rows[0].cells[mapping.example + 1]?.text === "") {
      mapping.exampleTranslation = mapping.example + 1;
      warn(`[${tab}] 例文の訳の列は見出しが空欄でした。例文の右隣の列として扱いました`);
    }
    if (mapping.term == null || mapping.meaning == null) {
      warn(`[${tab}] 必須の見出し（words / meaning）が見つかりません。このタブは読み飛ばしました`);
      continue;
    }
    for (const { rowNumber, cells } of rows.slice(1)) {
      const get = (field) => (mapping[field] != null ? (cells[mapping[field]]?.text ?? "") : "");
      const term = get("term");
      if (!term) {
        warn(`[${tab}] ${rowNumber}行目: 単語が空のため読み飛ばしました`);
        continue;
      }
      const rawTerm = cells[mapping.term]?.raw ?? "";
      if (rawTerm !== rawTerm.trim()) warn(`[${tab}] ${rowNumber}行目: 単語「${term}」の前後に余分な空白や改行がありました（取り除きました）`);
      if (term.includes("\n")) warn(`[${tab}] ${rowNumber}行目: 単語「${term.replace(/\n/g, "⏎")}」の途中に改行があります`);
      const card = {
        id: makeId(tab, term),
        pos: tab,
        term,
        meaning: get("meaning"),
        example: get("example"),
        exampleTranslation: get("exampleTranslation"),
        note: get("note"),
      };
      if (!card.meaning) warn(`[${tab}] ${rowNumber}行目: 「${term}」に意味がありません`);
      if (card.example && !card.exampleTranslation) warn(`[${tab}] ${rowNumber}行目: 「${term}」に例文はあるが訳がありません`);
      if (!card.example && card.exampleTranslation) warn(`[${tab}] ${rowNumber}行目: 「${term}」に訳はあるが例文がありません`);
      if (card.id.includes("#")) warn(`[${tab}] ${rowNumber}行目: 「${term}」は同じタブに重複しています（ID: ${card.id}）`);
      words.push(compact(card));
    }
  }
  return words;
};

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
  const mapping = mapColumns(rows[0].cells, { title: ["title", "タイトル"], body: ["reference", "本文", "内容"], url: ["url", "リンク"] });
  const makeId = makeIdFactory();
  const tips = [];
  for (const { rowNumber, cells } of rows.slice(1)) {
    const get = (field) => (mapping[field] != null ? (cells[mapping[field]]?.text ?? "") : "");
    const title = get("title");
    if (!title) {
      warn(`[reference] ${rowNumber}行目: タイトルが空のため読み飛ばしました（本文: 「${get("body").slice(0, 30)}」 URL: ${get("url") ? "あり" : "なし"}）`);
      continue;
    }
    const url = get("url");
    if (url && !/^https?:\/\//.test(url)) warn(`[reference] ${rowNumber}行目: 「${title}」の URL が http(s) で始まっていません`);
    tips.push(compact({ id: makeId("tip", title), title, body: get("body"), url }));
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

  const words = buildWords(workbook);
  const ingOrTo = buildIngOrTo(workbook);
  const tips = buildTips(workbook);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 1) + "\n");
  write("words.json", words);
  write("ing-or-to.json", ingOrTo);
  write("tips.json", tips);
  // 内容が変わったときだけ変わる版。アプリはこの値で、プリセットを DB に入れ直すか決める
  const version = crypto.createHash("sha1").update(JSON.stringify([words, ingOrTo, tips])).digest("hex").slice(0, 12);
  write("version.json", { version });

  const perPos = WORD_TABS.map((tab) => `${tab}: ${words.filter((w) => w.pos === tab).length}`).join(" / ");
  const summary = `単語カード ${words.length} 枚（${perPos}）、ing or to ${ingOrTo.length} 問、ヒント ${tips.length} 件`;
  fs.writeFileSync(REPORT, [`# プリセット変換の報告書`, summary, "", ...report.map((line) => `- ${line}`), ""].join("\n"));
  console.log(summary);
  console.log(`報告 ${report.length} 件 → ${path.relative(ROOT, REPORT)}`);
})();
