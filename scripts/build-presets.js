/**
 * アプリに同梱するプリセット JSON を、Markdown から作る
 *
 * 元データ（リポジトリで管理する。Google スプレッドシートは使わない）
 *   presets-src/tips.md        ホームの「今日のヒント」（## タイトル の下に本文）
 *   presets-src/ing-or-to.md   ing or to の問題（## 単語 の下に「- 答え:」「- 意味:」「- 例文:」「- 補足:」）
 *   presets-src/default-words/<品詞>.md   初回起動で単語帳に入れる既定の単語（## 単語 の下に「- 意味:」「- 例文:」「- 例文の訳:」「- メモ:」）
 *
 * 使い方: node scripts/build-presets.js
 *
 * 出力:
 *   assets/presets/ing-or-to.json  ing or to の問題
 *   assets/presets/tips.json       ヒント
 *   assets/presets/default-words.json  既定の単語（初回起動で、新しい単語帳に1度だけ入れる。版の計算には含めない）
 *   assets/presets/version.json    内容から計算した版（変更の検出用。変わると、アプリは起動時に入れ直す）
 *   preset-source/report.txt       要確認の行の報告書（公開しない）
 *
 * 単語は同梱しない（単語帳はユーザーが自分で作る）
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parseEntries, parseTips } = require("./markdown-data");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "presets-src");
const OUT_DIR = path.join(ROOT, "assets", "presets");
const REPORT = path.join(ROOT, "preset-source", "report.txt");

/** ing or to の問題の項目名 → JSON のキー */
const ING_OR_TO_LABELS = { 答え: "answer", 意味: "meaning", 例文: "example", 補足: "note" };

const report = [];
const warn = (message) => report.push(message);

/** 重複しない ID を作る（接頭辞 + 名前。同じ名前が2回出たら連番を付ける） */
const makeIdFactory = () => {
  const used = new Map();
  return (prefix, name) => {
    const base = `${prefix}:${name.toLowerCase().replace(/\s+/g, "-")}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  };
};

const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== "" && v != null));

const read = (name) => fs.readFileSync(path.join(SRC_DIR, name), "utf8");

const buildIngOrTo = () => {
  const makeId = makeIdFactory();
  const items = [];
  const answers = new Set();
  for (const entry of parseEntries(read("ing-or-to.md"), ING_OR_TO_LABELS)) {
    if (!entry.term) continue;
    answers.add(entry.answer ?? "");
    if (!entry.answer) warn(`[ing or to] 「${entry.term}」に答えがありません`);
    items.push(compact({ id: makeId("ingOrTo", entry.term), term: entry.term, answer: entry.answer, meaning: entry.meaning, example: entry.example, note: entry.note }));
  }
  warn(`[ing or to] 答えの値の種類: ${[...answers].map((a) => `「${a}」`).join(" ")}`);
  return items;
};

const buildTips = () => {
  const makeId = makeIdFactory();
  const tips = [];
  for (const { title, body } of parseTips(read("tips.md"))) {
    if (!title && !body) continue;
    // タイトルが空でも、本文があれば登録する（ホームでは本文だけを表示する）。title の項目は必ず残す（アプリの DB は title が必須）
    if (!title) warn(`[ヒント] タイトルが空です（本文だけを登録しました: 「${body.slice(0, 30)}」）`);
    tips.push({ id: makeId("tip", title || body.slice(0, 20)), title, body });
  }
  return tips;
};

/** 既定の単語。ファイル名が品詞のキー（presets-src/default-words/noun.md など） */
const DEFAULT_WORD_POS = ["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];
const DEFAULT_WORD_LABELS = { 意味: "meaning", 例文: "example", 例文の訳: "exampleTranslation", メモ: "note" };

const buildDefaultWords = () => {
  const words = [];
  for (const pos of DEFAULT_WORD_POS) {
    const file = path.join(SRC_DIR, "default-words", `${pos}.md`);
    if (!fs.existsSync(file)) continue;
    const seen = new Set();
    for (const entry of parseEntries(fs.readFileSync(file, "utf8"), DEFAULT_WORD_LABELS)) {
      if (!entry.term) continue;
      if (!entry.meaning) {
        warn(`[既定の単語] 「${entry.term}」（${pos}）に意味がないため、読み飛ばしました`);
        continue;
      }
      const key = entry.term.toLowerCase();
      if (seen.has(key)) warn(`[既定の単語] 「${entry.term}」（${pos}）が重複しています`);
      seen.add(key);
      words.push(compact({ term: entry.term, meaning: entry.meaning, partOfSpeech: pos, example: entry.example, exampleTranslation: entry.exampleTranslation, note: entry.note }));
    }
  }
  return words;
};

const ingOrTo = buildIngOrTo();
const tips = buildTips();

fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 1) + "\n");
write("ing-or-to.json", ingOrTo);
write("tips.json", tips);
const defaultWords = buildDefaultWords();
write("default-words.json", defaultWords);
// 内容が変わったときだけ変わる版。アプリはこの値で、プリセットを DB に入れ直すか決める
const version = crypto.createHash("sha1").update(JSON.stringify([ingOrTo, tips])).digest("hex").slice(0, 12);
write("version.json", { version });

const summary = `ing or to ${ingOrTo.length} 問、ヒント ${tips.length} 件、既定の単語 ${defaultWords.length} 語`;
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, [`# プリセット変換の報告書`, summary, "", ...report.map((line) => `- ${line}`), ""].join("\n"));
console.log(summary);
console.log(`報告 ${report.length} 件 → ${path.relative(ROOT, REPORT)}`);
