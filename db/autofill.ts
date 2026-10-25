import type { PartOfSpeech } from "./types";

/**
 * 単語の入力欄の「自動入力」（品詞・例文の訳）の判定
 *
 * 自動で入れてよいのは、次の2つの場合だけ。あなたが入力・選択した値は、上書きしない
 * - 欄が空のとき
 * - 欄の値が、前回に自動で入れた値のままのとき（単語や例文を直したら、入れ直す）
 */
export type AutoWritePlan<T> = { write: false } | { write: true; value: T };

/**
 * 自動入力の候補（candidate）を、欄に書き込むか決める
 * - current: 欄の今の値、lastAuto: 前回に自動で入れた値（なければ null）、empty: 空を表す値
 * - 候補がない（null）ときは、前回に自動で入れた値だけを消す（あなたの入力は消さない）
 */
export function planAutoWrite<T>(current: T, lastAuto: T | null, candidate: T | null, empty: T): AutoWritePlan<T> {
  const mayOverwrite = current === empty || current === lastAuto;
  if (!mayOverwrite) return { write: false };
  const next = candidate ?? empty;
  return next === current ? { write: false } : { write: true, value: next };
}

/** 意味・例文の訳を作っている途中・失敗したときの状態 */
export type TranslationStatus = { state: "idle" | "loading" | "failed"; message: string | null };

/** 入力フォームに渡す、自動入力の状態（どの値が自動で入ったか、訳の状態） */
export type CardAutoFillState = {
  /** 最後に、自動で入れた品詞（いまの品詞がこれと同じなら、自動の下書きとして札を出す） */
  autoPartOfSpeech: PartOfSpeech | null;
  /** 最後に、自動で入れた意味 */
  autoMeaning: string | null;
  meaningStatus: TranslationStatus;
  /** 例文ごと（例文の並びの順）の、訳を作っている状態。足りない分は、何もしていない */
  translationStatuses: TranslationStatus[];
};

/**
 * 単語から、意味の下書きを作るための、翻訳にかける文字を作る。訳さないほうがよいときは null
 * - かっこの中の補足は除く（divide (into) → divide）
 * - 「～」「…」を含む表現は、機械翻訳では意味が崩れるので訳さない
 * - 英字が2文字未満（記号や1文字）も訳さない
 */
export function meaningQuery(term: string): string | null {
  const text = term.replace(/[（(][^）)]*[）)]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/[～〜~…]/.test(text)) return null;
  if ((text.match(/[A-Za-z]/g) ?? []).length < 2) return null;
  return text;
}
