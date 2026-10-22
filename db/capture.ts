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

/** 選んだ文字が、日本語（ひらがな・カタカナ・漢字）を含むか。英語の単語帳に入れる対象ではない可能性が高い */
export function looksJapanese(text: string): boolean {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

/** 単語ではなく、文のように長いか（語数が多い）。文の場合は、例文として扱う案内を出す */
export function looksLikeSentence(text: string): boolean {
  return text.split(" ").filter(Boolean).length >= 6;
}
