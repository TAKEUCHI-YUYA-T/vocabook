/**
 * 品詞の推定に使う辞書を、WordNet 3.0（Princeton 大学）から作る
 *
 * 使い方: node scripts/build-pos-dictionary.js <WordNet の dict フォルダ>
 *   dict フォルダは、https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz を展開したもの
 *   （index.sense と index.noun を読む）
 *
 * 出力:
 *   assets/dictionary/pos.json              1語の見出し語を、主な品詞ごとに改行区切りで並べたもの（ライセンス文も含む）
 *   assets/dictionary/wordnet-license.json  WordNet のライセンス文（アプリの「ライセンス」画面に表示する）
 *   assets/dictionary/WORDNET-LICENSE.txt   同じ文（ライセンスの条件により、データの写しには必ず添える）
 *
 * 主な品詞は、意味ごとの出現回数（index.sense の tag_cnt）の合計が最も多い品詞。
 * 回数が同じなら、意味の数が多い品詞。それも同じなら、動詞 > 形容詞 > 副詞 > 名詞 の順
 * 2語以上の見出し語は入れない（アプリでは、空白を含む語句は「熟語」とする）
 */
const fs = require("fs");
const path = require("path");

const DICT = process.argv[2];
if (!DICT) {
  console.error("使い方: node scripts/build-pos-dictionary.js <WordNet の dict フォルダ>");
  process.exit(1);
}
const OUT_DIR = path.join(__dirname, "..", "assets", "dictionary");

/** index.sense の品詞の番号（5 は形容詞の衛星。形容詞として扱う） */
const SS_TYPE = { 1: "noun", 2: "verb", 3: "adjective", 4: "adverb", 5: "adjective" };
const TIE_ORDER = ["verb", "adjective", "adverb", "noun"];
/** 辞書に入れる見出し語の文字（英小文字・数字と、語の中の ' . - ） */
const WORD = /^[a-z0-9][a-z0-9'.-]*$/;

// 見出し語ごとに、品詞別の出現回数と意味の数を数える
const stats = new Map();
for (const line of fs.readFileSync(path.join(DICT, "index.sense"), "utf8").split("\n")) {
  if (!line) continue;
  // 形式: lemma%ss_type:lex_filenum:lex_id:head_word:head_id synset_offset sense_number tag_cnt
  const [senseKey, , , tagCount] = line.split(" ");
  const at = senseKey.indexOf("%");
  const lemma = senseKey.slice(0, at);
  const pos = SS_TYPE[senseKey[at + 1]];
  if (!pos || !WORD.test(lemma)) continue;
  if (!stats.has(lemma)) stats.set(lemma, {});
  const entry = (stats.get(lemma)[pos] ??= { tags: 0, senses: 0 });
  entry.tags += Number(tagCount) || 0;
  entry.senses += 1;
}

const dominant = (byPos) =>
  Object.entries(byPos).sort(
    ([posA, a], [posB, b]) => b.tags - a.tags || b.senses - a.senses || TIE_ORDER.indexOf(posA) - TIE_ORDER.indexOf(posB)
  )[0][0];

const lists = { noun: [], verb: [], adjective: [], adverb: [] };
for (const [lemma, byPos] of stats) lists[dominant(byPos)].push(lemma);
for (const words of Object.values(lists)) words.sort();

// ライセンス文は、配布ファイル（index.noun）の先頭の「  番号 本文」の行から取り出す（手で写さない）
const license = [];
for (const line of fs.readFileSync(path.join(DICT, "index.noun"), "utf8").split("\n")) {
  const match = /^ {2}\d+ (.*)$/.exec(line);
  if (!match) break;
  license.push(match[1].trimEnd());
}
if (!license.some((line) => line.includes("Copyright 2006 by Princeton University"))) {
  throw new Error("index.noun からライセンス文を取り出せませんでした");
}
const licenseText = license.join("\n").trim();

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "pos.json"),
  // ライセンス文は、データの写しに必ず添える決まりのため、pos.json の中にも入れる
  JSON.stringify({ source: "WordNet 3.0", license: licenseText, noun: lists.noun.join("\n"), verb: lists.verb.join("\n"), adjective: lists.adjective.join("\n"), adverb: lists.adverb.join("\n") }) + "\n"
);
fs.writeFileSync(path.join(OUT_DIR, "wordnet-license.json"), JSON.stringify({ name: "WordNet 3.0", text: licenseText }, null, 1) + "\n");
fs.writeFileSync(path.join(OUT_DIR, "WORDNET-LICENSE.txt"), licenseText + "\n");

const total = Object.values(lists).reduce((sum, words) => sum + words.length, 0);
console.log(`見出し語 ${total}（名詞 ${lists.noun.length}、動詞 ${lists.verb.length}、形容詞 ${lists.adjective.length}、副詞 ${lists.adverb.length}）`);
