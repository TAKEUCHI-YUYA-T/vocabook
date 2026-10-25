/**
 * 例文（英文と、その和訳）の扱い
 * 1つの単語に、例文を最大3つまで持つ。例文ごとに、英文と和訳を対にして持つ
 */
export type Example = { text: string; translation: string };

export const MAX_EXAMPLES = 3;

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** 行頭の番号（①〜⑳、(1)、（1）、1. 1)） */
const MARKER = /^\s*(?:([①-⑳])|\((\d{1,2})\)|（(\d{1,2})）|(\d{1,2})[.)．）])\s*/;

const markerNumber = (match: RegExpMatchArray): number => (match[1] ? CIRCLED.indexOf(match[1]) + 1 : Number(match[2] ?? match[3] ?? match[4]));

export type NumberedBlock = {
  /** 行頭の番号（なければ null） */
  marker: number | null;
  /** 番号を除いた本文（途中で改行された続きの行は、空白でつなぐ） */
  body: string;
};

/**
 * 1つの欄に入った複数の文を、1文ずつに分ける
 * 区切りは、行頭の番号か空行。番号がなく、空行もなければ、全体を1つとする
 */
export function splitNumbered(text: string): NumberedBlock[] {
  const blocks: { marker: number | null; lines: string[] }[] = [];
  let startNew = true;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim()) {
      startNew = true;
      continue;
    }
    const match = raw.match(MARKER);
    if (startNew || match) {
      blocks.push({ marker: match ? markerNumber(match) : null, lines: [] });
    }
    blocks[blocks.length - 1].lines.push((match ? raw.slice(match[0].length) : raw).trim());
    startNew = false;
  }
  return blocks.map((block) => ({ marker: block.marker, body: block.lines.filter(Boolean).join(" ") })).filter((block) => block.body);
}

/** 複数の文を、番号つきで1つの欄にまとめる（CSV の書き出し用）。1つだけなら、番号は付けない */
export function joinNumbered(items: string[]): string {
  const filled = items.map((body, index) => ({ body: body.trim(), index })).filter((item) => item.body);
  if (filled.length === 1 && filled[0].index === 0) return filled[0].body;
  return filled.map((item) => `${CIRCLED[item.index] ?? `(${item.index + 1})`}${item.body}`).join("\n");
}

export type PairResult = {
  /** 例文（最大3つ） */
  examples: Example[];
  /** 4つ目以降の例文（あふれた分）。捨てずに、メモに移す（extraExamplesNote） */
  extra: Example[];
  /** 3つを超えた例文があった（extra が空でない） */
  overflow: boolean;
  /** 英文と訳の数が合わず、対応づけられなかった（訳は、1つ目の例文にまとめた） */
  ambiguous: boolean;
};

/**
 * 例文の欄と、訳の欄（どちらも、複数の文が入りうる）から、英文と訳の対を作る
 * - 訳の数が英文の数と同じ、または、訳に番号があれば、対応づける
 * - 対応づけられないときは、訳を捨てず、1つ目の例文の訳にまとめる（ambiguous）
 * - 4つ目以降の英文は、extra に分ける（overflow）。メモに移すのは、呼び出し側
 */
export function pairExamples(exampleText: string, translationText: string): PairResult {
  const texts = splitNumbered(exampleText);
  const translations = splitNumbered(translationText);
  let ambiguous = false;

  const bodies = texts.map((block) => block.body);
  const pairs: string[] = bodies.map(() => "");

  if (translations.length > 0) {
    if (bodies.length === 0) {
      // 英文のない訳（訳だけ残っている）
      bodies.push("");
      pairs.push(translations.map((t) => t.body).join(" "));
    } else if (translations.length === bodies.length) {
      translations.forEach((t, i) => (pairs[i] = t.body));
    } else if (translations.every((t) => t.marker !== null) && translations.every((t) => (t.marker as number) >= 1 && (t.marker as number) <= bodies.length)) {
      for (const t of translations) pairs[(t.marker as number) - 1] = [pairs[(t.marker as number) - 1], t.body].filter(Boolean).join(" ");
    } else {
      ambiguous = true;
      pairs[0] = translations.map((t) => t.body).join(" ");
    }
  }

  const all: Example[] = bodies.map((text, i) => ({ text, translation: pairs[i] }));
  const extra = all.slice(MAX_EXAMPLES);
  return { examples: all.slice(0, MAX_EXAMPLES), extra, overflow: extra.length > 0, ambiguous };
}

/** あふれた例文（4つ目以降）を、メモに追記する文にする。番号は、元の番号のまま */
export function extraExamplesNote(extra: readonly Example[]): string {
  if (extra.length === 0) return "";
  const lines = extra.map((e, i) => {
    const number = CIRCLED[MAX_EXAMPLES + i] ?? `(${MAX_EXAMPLES + i + 1})`;
    return [`${number}${e.text}`, e.translation].filter(Boolean).join("\n");
  });
  return `例文の続き\n${lines.join("\n")}`;
}

/** メモに、あふれた例文を追記した値（メモが空なら、その文だけ） */
export const appendExtraToNote = (note: string, extra: readonly Example[]): string =>
  [note.trim(), extraExamplesNote(extra)].filter(Boolean).join("\n\n");

/** 空の例文を取り除き、前後の空白を除いて、最大3つにそろえる（超えた分は呼び出し側で検証する） */
export function compactExamples(examples: readonly Example[] | undefined): Example[] {
  return (examples ?? [])
    .map((e) => ({ text: (e.text ?? "").trim(), translation: (e.translation ?? "").trim() }))
    .filter((e) => e.text || e.translation);
}
