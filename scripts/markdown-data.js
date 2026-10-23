/**
 * アプリに同梱するデータ（ヒント・ing or to の問題・単語）を、Markdown で読み書きする部品
 *
 * 形式（どれも、「## 見出し」ごとに1件）
 *   ヒント:       ## タイトル の下に、本文を自由に書く
 *   問題・単語:   ## 単語 の下に、「- 項目名: 値」を並べる。値が複数行なら、2行目からは2文字下げる
 *                空の項目は書かない。見出しより前の文章（説明）は読み飛ばす
 *                単語が複数行のときは、見出しに1行目を書き、2行目以降は「- 単語の続き:」に書く
 *
 * 画面や DB には依存しない。scripts/build-presets.js・単語の変換と、テストから使う
 */
"use strict";

/** 単語（見出し）が複数行のときの、2行目以降を書く項目の名前 */
const TERM_REST_LABEL = "単語の続き";
/** 読み込み中に、単語の2行目以降を一時的に入れておくキー（項目名と重ならない名前） */
const TERM_REST_KEY = "__termRest";

/** 先頭の「## 見出し」ごとに区切る。見出しより前の文章は捨てる */
function splitSections(markdown) {
  const sections = [];
  let current = null;
  for (const line of markdown.replace(/^﻿/, "").split(/\r?\n/)) {
    const heading = /^## (.*)$/.exec(line);
    if (heading) {
      current = { heading: heading[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

/** 前後の空行を取り除き、行を改行でつなぐ */
function joinLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end).join("\n");
}

/** ヒントを読む: [{ title, body }] */
function parseTips(markdown) {
  return splitSections(markdown).map((section) => ({ title: section.heading, body: joinLines(section.lines) }));
}

/** ヒントを書く */
function formatTips(tips, intro) {
  const parts = ["# 今日のヒント", "", ...(intro ? [intro, ""] : [])];
  for (const tip of tips) {
    if (/^## /m.test(tip.body ?? "")) throw new Error(`ヒント「${tip.title}」の本文に、行頭の「## 」があります`);
    parts.push(`## ${tip.title ?? ""}`, "", ...(tip.body ? [tip.body, ""] : []));
  }
  return parts.join("\n").replace(/\n+$/, "\n");
}

/**
 * 項目つきの一覧を読む: [{ term, ...項目 }]
 * labels は、{ 項目名: キー }。知らない項目名の行や、項目の外の文章があれば、場所を示して例外にする（書き間違いに気づけるように）
 */
function parseEntries(markdown, labels) {
  return splitSections(markdown).map((section) => {
    const entry = { term: section.heading };
    let key = null;
    let buffer = [];
    const flush = () => {
      if (key) entry[key] = joinLines(buffer);
      key = null;
      buffer = [];
    };
    for (const line of section.lines) {
      const field = /^- ([^:：]+)[:：] ?(.*)$/.exec(line);
      if (field) {
        const name = field[1].trim();
        const isTermRest = name === TERM_REST_LABEL;
        if (!isTermRest && !(name in labels)) {
          throw new Error(`「${section.heading}」に、知らない項目「${name}」があります（使える項目: ${Object.keys(labels).join("、")}）`);
        }
        flush();
        key = isTermRest ? TERM_REST_KEY : labels[name];
        buffer = [field[2]];
      } else if (key && (line === "" || line.startsWith("  "))) {
        buffer.push(line.startsWith("  ") ? line.slice(2) : line);
      } else if (line.trim() !== "") {
        throw new Error(`「${section.heading}」に、項目ではない行があります: ${line.slice(0, 40)}`);
      }
    }
    flush();
    if (TERM_REST_KEY in entry) {
      entry.term = `${entry.term}\n${entry[TERM_REST_KEY]}`;
      delete entry[TERM_REST_KEY];
    }
    return entry;
  });
}

/** 項目つきの一覧を書く。fields は、[[キー, 項目名], ...]（書く順） */
function formatEntries(entries, fields, title, intro) {
  const parts = [`# ${title}`, "", ...(intro ? [intro, ""] : [])];
  for (const entry of entries) {
    const [heading, ...termRest] = String(entry.term).split("\n");
    parts.push(`## ${heading}`, "");
    const lines = termRest.length ? [[TERM_REST_KEY, TERM_REST_LABEL], ...fields] : fields;
    for (const [key, label] of lines) {
      const value = key === TERM_REST_KEY ? termRest.join("\n") : entry[key];
      if (!value) continue;
      const [first, ...rest] = String(value).split("\n");
      parts.push(`- ${label}: ${first}`, ...rest.map((line) => (line === "" ? "" : `  ${line}`)));
    }
    parts.push("");
  }
  return parts.join("\n").replace(/\n+$/, "\n");
}

module.exports = { parseTips, formatTips, parseEntries, formatEntries };
