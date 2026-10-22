/**
 * 他のアプリで選んだ文字を、単語帳に登録するための下ごしらえ
 * 届く文字は、他のアプリが自由に作れる、信頼できない入力として扱う
 */

/** 単語の欄に入れる文字の上限（登録できる単語の上限と同じ） */
export const MAX_CAPTURED_TERM = 200;

/**
 * 選んだ文字を、単語の欄に入れる形に整える
 * - 制御文字・目に見えない文字を除く（表示や保存の乱れ、見分けのつかない重複を防ぐ）
 * - 改行や連続する空白を、1つの空白にまとめる
 * - 前後の句読点や引用符を取り除く（「"apple".」のように選んでしまった場合）
 */
export function cleanCapturedText(raw: string): string {
  const withoutInvisible = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, (char) => (char === "\n" || char === "\t" || char === "\r" ? " " : ""))
    .replace(/\s+/g, " ")
    .trim();
  const trimmed = withoutInvisible.replace(/^[\s"'“”‘’「」『』()（）[\]{}<>.,;:!?、。！？…・]+|[\s"'“”‘’「」『』()（）[\]{}<>.,;:!?、。！？…・]+$/g, "");
  return trimmed.length > MAX_CAPTURED_TERM ? trimmed.slice(0, MAX_CAPTURED_TERM).trim() : trimmed;
}

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

/**
 * URL の末尾の「文字列フラグメント」（#:~:text=...）から、強調された文字を取り出す
 * Chrome が、選んだ文字を共有するときに付ける形式。書式: text=[前後の文脈-,]開始[,終了][,-後ろの文脈]
 * 取り出せなければ空文字
 */
export function textFromUrlFragment(url: string): string {
  const marker = ":~:text=";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  // 次の指示（&text=...）の手前までを、最初の指示として読む
  const directive = url.slice(index + marker.length).split("&")[0];
  const parts = directive.split(",");
  if (parts[0]?.endsWith("-") && parts.length > 1) parts.shift(); // 前の文脈（prefix-）
  if (parts.length > 1 && parts[parts.length - 1].startsWith("-")) parts.pop(); // 後ろの文脈（-suffix）
  const decode = (value: string | undefined) => {
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return ""; // 壊れた符号化は、使わない
    }
  };
  const start = decode(parts[0]);
  const end = decode(parts[1]);
  return end ? `${start} … ${end}` : start;
}

export type SharedSelection = {
  term: string;
  /** plain: 文字がそのまま届いた / fragment: URL から取り出した / url-only: URL だけで、単語を取り出せなかった */
  kind: "plain" | "fragment" | "url-only";
};

/**
 * 共有された文字から、単語の欄に入れる文字を取り出す
 * Chrome などは、選んだ文字ではなく、URL（や「文字 + URL」）を送ることがある
 *  1. URL を除いた文字が残れば、それを使う
 *  2. なければ、URL の #:~:text= から、選んだ文字を取り出す
 *  3. それも取り出せなければ、空にして、案内を出せるようにする
 */
export function extractSelection(raw: string): SharedSelection {
  const urls = raw.match(URL_PATTERN) ?? [];
  const plain = cleanCapturedText(raw.replace(URL_PATTERN, " "));
  if (plain) return { term: plain, kind: "plain" };
  for (const url of urls) {
    const fromFragment = cleanCapturedText(textFromUrlFragment(url));
    if (fromFragment) return { term: fromFragment, kind: "fragment" };
  }
  return { term: "", kind: urls.length > 0 ? "url-only" : "plain" };
}

/** 選んだ文字が、日本語（ひらがな・カタカナ・漢字）を含むか。英語の単語帳に入れる対象ではない可能性が高い */
export function looksJapanese(text: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

/** 単語ではなく、文のように長いか（語数が多い）。文の場合は、例文として扱う案内を出す */
export function looksLikeSentence(text: string): boolean {
  return text.split(" ").filter(Boolean).length >= 6;
}
