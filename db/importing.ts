import Papa from "papaparse";
import { validateCardInput, ValidationError } from "./repository";
import type { CardInput, IngOrToAnswer, PartOfSpeech } from "./types";
import { ingOrToLabel, PARTS_OF_SPEECH } from "./types";

/**
 * 取り込み（貼り付け・CSV）の処理
 * 表に分解 → 列の対応付け → 行ごとの検証 → プレビュー → 書き込み、の順に進める
 * 画面や DB に依存しない関数だけで作り、単体でテストできるようにしている
 */

/** 取り込みの上限。極端に大きな入力で、アプリが固まらないようにする */
export const IMPORT_LIMITS = { maxRows: 5000, maxBytes: 5 * 1024 * 1024 } as const;

/** 取り込める項目。必須は term と meaning */
export type ImportField = "term" | "meaning" | "partOfSpeech" | "example" | "exampleTranslation" | "note" | "answer";

export const IMPORT_FIELDS: { key: ImportField; label: string; required: boolean }[] = [
  { key: "term", label: "単語", required: true },
  { key: "meaning", label: "意味", required: true },
  { key: "partOfSpeech", label: "品詞", required: false },
  { key: "example", label: "例文", required: false },
  { key: "exampleTranslation", label: "例文の訳", required: false },
  { key: "note", label: "メモ", required: false },
  { key: "answer", label: "ing or to", required: false },
];

/** 見出し名の別名（小文字・空白なしで比べる）。列の並びが違っても、名前で見つける */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  term: ["単語", "英単語", "word", "words", "term", "vocabulary", "表面", "見出し語"],
  meaning: ["意味", "訳", "日本語", "meaning", "meanings", "definition", "translation", "日本語訳"],
  partOfSpeech: ["品詞", "pos", "partofspeech", "type"],
  example: ["例文", "example", "examples", "sentence", "英文"],
  exampleTranslation: ["例文の訳", "例文訳", "例文和訳", "exampletranslation", "sentencetranslation", "訳文"],
  note: ["メモ", "補足", "備考", "note", "notes", "supplement", "comment"],
  answer: ["ingorto", "ing/to", "後ろの形", "後ろに続く形"],
};

/** 品詞の別名。日本語の名前や、英語の短縮形でも受け付ける */
const POS_ALIASES: Record<PartOfSpeech, string[]> = {
  noun: ["noun", "n", "名詞", "名"],
  verb: ["verb", "v", "動詞", "動"],
  adverb: ["adverb", "adv", "副詞", "副"],
  adjective: ["adjective", "adj", "形容詞", "形"],
  preposition: ["preposition", "prep", "前置詞", "前"],
  conjunction: ["conjunction", "conj", "接続詞", "接"],
  auxiliaryVerb: ["auxiliaryverb", "auxiliary", "aux", "助動詞", "助"],
  idiom: ["idiom", "phrase", "熟語", "イディオム", "句"],
};

const normalizeKey = (text: string) => text.toLowerCase().replace(/[\s_\-・:：]/g, "");

/** ing or to の答えの別名（「～ing」「to～」のほか、ing / to / 動名詞 / 不定詞 なども受け付ける） */
const ING_OR_TO_ALIASES: Record<IngOrToAnswer, string[]> = {
  ing: ["ing", "～ing", "~ing", "doing", "動名詞"],
  to: ["to", "to～", "to~", "todo", "不定詞"],
};

/** ing or to の文字を、答え（"ing" / "to"）にする。空や、分からない文字なら null */
export function parseIngOrTo(text: string): IngOrToAnswer | null {
  const key = normalizeKey(text);
  if (!key) return null;
  if (ING_OR_TO_ALIASES.ing.includes(key)) return "ing";
  if (ING_OR_TO_ALIASES.to.includes(key)) return "to";
  return null;
}

/** 品詞の文字を、アプリの品詞キーにする。分からなければ null */
export function parsePartOfSpeech(text: string): PartOfSpeech | null {
  const key = normalizeKey(text);
  if (!key) return null;
  for (const part of PARTS_OF_SPEECH) {
    if (POS_ALIASES[part.key].includes(key)) return part.key;
  }
  return null;
}

export type ParsedTable = {
  rows: string[][];
  delimiter: string;
  /** 上限を超えたため、後ろを切り捨てたか */
  truncated: boolean;
};

/**
 * テキストを表（行 × 列）に分解する
 * 区切り文字（タブ・カンマなど）は自動で判定する。セルの中の改行や、引用符で囲まれた値にも対応する
 */
export function parseTable(text: string): ParsedTable {
  if (text.length > IMPORT_LIMITS.maxBytes) {
    throw new ValidationError("データが大きすぎます（5MB まで）。ファイルを分けて取り込んでください");
  }
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    delimitersToGuess: ["\t", ",", ";", "|"],
    skipEmptyLines: "greedy",
  });
  const rows = result.data.map((row) => row.map((cell) => (cell ?? "").toString()));
  const truncated = rows.length > IMPORT_LIMITS.maxRows + 1;
  return {
    rows: truncated ? rows.slice(0, IMPORT_LIMITS.maxRows + 1) : rows,
    delimiter: result.meta.delimiter,
    truncated,
  };
}

export type ColumnMapping = Partial<Record<ImportField, number>>;

export type DetectedColumns = {
  mapping: ColumnMapping;
  /** 1行目が見出し行だったか。見出しが見つからなければ、1行目もデータとして扱う */
  hasHeader: boolean;
};

/** 1行目の見出し名から、どの列がどの項目かを推測する */
export function detectColumns(table: string[][]): DetectedColumns {
  const header = (table[0] ?? []).map(normalizeKey);
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    const index = header.findIndex((name, i) => name && HEADER_ALIASES[field].includes(name) && !Object.values(mapping).includes(i));
    if (index >= 0) mapping[field] = index;
  }
  if (mapping.term !== undefined && mapping.meaning !== undefined) return { mapping, hasHeader: true };

  // 見出しが見つからない: 1列目を単語、2列目を意味、とみなす（列が足りなければ取り込めない）
  const columnCount = Math.max(0, ...table.slice(0, 20).map((row) => row.length));
  const positional: ColumnMapping = {};
  (["term", "meaning", "example", "exampleTranslation", "note"] as ImportField[]).slice(0, columnCount).forEach((field, i) => {
    positional[field] = i;
  });
  return { mapping: positional, hasHeader: false };
}

export type ImportRowError = { rowNumber: number; message: string };

export type ImportPreview = {
  /** 取り込める行（検証済み） */
  valid: { rowNumber: number; input: CardInput }[];
  errors: ImportRowError[];
  /** 同じ単語帳にすでにある単語と、同じ単語・同じ意味のため、取り込まない行 */
  skippedDuplicates: number;
  /** 同じ単語がすでにあるが、意味が違うため、取り込む行（念のため知らせる） */
  sameTermDifferentMeaning: number;
  /** 取り込み内の行数（見出し行を除く） */
  totalRows: number;
};

/** すでに単語帳にある単語（重複の判定に使う） */
export type ExistingCard = { term: string; meaning: string };

const duplicateKey = (term: string, meaning: string) => `${term.trim().toLowerCase()}\u0000${meaning.trim()}`;

/**
 * 表と列の対応から、取り込めるデータを作る
 * - 1行ずつ検証し、不正な行は理由つきで除く（ほかの行は取り込める）
 * - 単語帳にすでにある同じ単語・同じ意味や、取り込み内の重複は、取り込まない
 */
export function buildPreview(table: string[][], mapping: ColumnMapping, hasHeader: boolean, existing: ExistingCard[] = []): ImportPreview {
  const preview: ImportPreview = { valid: [], errors: [], skippedDuplicates: 0, sameTermDifferentMeaning: 0, totalRows: 0 };
  if (mapping.term === undefined || mapping.meaning === undefined) return preview;

  const seen = new Set(existing.map((card) => duplicateKey(card.term, card.meaning)));
  const existingTerms = new Set(existing.map((card) => card.term.trim().toLowerCase()));
  const start = hasHeader ? 1 : 0;

  for (let i = start; i < table.length; i++) {
    const row = table[i];
    const rowNumber = i + 1; // 画面上の行番号（1 始まり。見出し行を含む）
    preview.totalRows++;
    // 書き出し時に、数式と誤解されないよう先頭に付けた ' は、取り込み時に取り除く（書き出し → 取り込みで内容が変わらないように）
    const unescape = (value: string) => (/^'[=+\-@]/.test(value) ? value.slice(1) : value);
    const cell = (field: ImportField) => (mapping[field] === undefined ? "" : unescape((row[mapping[field] as number] ?? "").trim()));

    const rawPos = cell("partOfSpeech");
    const partOfSpeech = parsePartOfSpeech(rawPos);
    const rawAnswer = cell("answer");
    const answer = parseIngOrTo(rawAnswer);
    const input: CardInput = {
      term: cell("term"),
      meaning: cell("meaning"),
      partOfSpeech,
      example: cell("example"),
      exampleTranslation: cell("exampleTranslation"),
      note: cell("note"),
      answer,
    };

    // 品詞や ing or to の分からない文字は、捨てずにメモへ残す（情報を失わないため）
    if (rawPos && !partOfSpeech) input.note = [input.note, `品詞: ${rawPos}`].filter(Boolean).join("\n");
    if (rawAnswer && !answer) input.note = [input.note, `ing or to: ${rawAnswer}`].filter(Boolean).join("\n");

    try {
      const value = validateCardInput(input, { allowEmptyMeaning: true });
      const key = duplicateKey(value.term, value.meaning);
      if (seen.has(key)) {
        preview.skippedDuplicates++;
        continue;
      }
      if (existingTerms.has(value.term.toLowerCase())) preview.sameTermDifferentMeaning++;
      seen.add(key);
      preview.valid.push({ rowNumber, input: value });
    } catch (error) {
      preview.errors.push({ rowNumber, message: error instanceof ValidationError ? error.message : "読み取れない行です" });
    }
  }
  return preview;
}

/**
 * 書き出す CSV のファイル名を、単語帳の名前から作る
 * ファイル名に使えない文字（\ / : * ? " < > | と制御文字）は _ にし、長さも抑える
 */
export function exportFileName(deckName: string): string {
  // eslint-disable-next-line no-control-regex
  const safe = deckName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 40);
  return `${safe || "vocabook"}.csv`;
}

/** 単語帳の単語を CSV にする（バックアップ用）。Excel で文字化けしないよう、先頭に BOM を付ける */
export function cardsToCsv(
  cards: { term: string; meaning: string; partOfSpeech: PartOfSpeech | null; example: string; exampleTranslation: string; note: string; answer?: string }[]
): string {
  const header = ["単語", "意味", "品詞", "例文", "例文の訳", "メモ", "ing or to"];
  const posLabel = (key: PartOfSpeech | null) => PARTS_OF_SPEECH.find((p) => p.key === key)?.label ?? "";
  const rows = cards.map((c) => [c.term, c.meaning, posLabel(c.partOfSpeech), c.example, c.exampleTranslation, c.note, ingOrToLabel(c.answer)]);
  // 数式として解釈されうる先頭文字（= + - @）を無害にする（CSV インジェクション対策）
  const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
  return "﻿" + Papa.unparse([header, ...rows.map((row) => row.map(safe))], { newline: "\r\n" });
}
