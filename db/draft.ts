import { looksJapanese } from "./capture";

/**
 * 選んだ単語の「意味」の下書きを作る（端末内の翻訳）
 * 翻訳の部品は、テストで差し替えられるよう、関数として受け取る
 */
export type TranslateFn = (params: {
  input: string;
  sourceLangCode: string;
  targetLangCode: string;
  /** モデルのダウンロードを、Wi-Fi のときだけにするか */
  requiresWifi?: boolean;
}) => Promise<{ translatedTexts: string | string[] | Record<string, string | string[]>; sourceLanguage: string | null }>;

export type DraftResult =
  | { status: "ok"; meaning: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** 翻訳を待つ時間の上限。モデルのダウンロード中などで、画面が固まったままにならないようにする */
export const DRAFT_TIMEOUT_MS = 30_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/** エラーを、ユーザーに見せる短い理由にする */
export function describeTranslationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "TIMEOUT") return "翻訳に時間がかかっています。通信状態を確認して、もう一度試してください";
  if (/Cannot find native module/i.test(message)) return "この版のアプリは、翻訳に対応していません。アプリを更新してください。意味は手で入力できます";
  if (/MODEL_DOWNLOAD|download|network|connect|UnknownHost|timeout/i.test(message)) {
    return "翻訳のデータを取得できませんでした。初回だけ、通信が必要です（約30MB）";
  }
  return "翻訳できませんでした。意味は手で入力してください";
}

/**
 * 英語の単語・熟語から、日本語の意味の下書きを作る
 * 日本語の文字を含む場合は、翻訳しない（英語の単語帳に入れる対象ではないため）
 */
export async function draftMeaning(text: string, translate: TranslateFn, timeoutMs: number = DRAFT_TIMEOUT_MS): Promise<DraftResult> {
  if (!text.trim()) return { status: "skipped", reason: "文字が空です" };
  if (looksJapanese(text)) return { status: "skipped", reason: "日本語の文字を含むため、意味の下書きは作りません" };

  try {
    const result = await withTimeout(translate({ input: text, sourceLangCode: "en", targetLangCode: "ja" }), timeoutMs);
    const translated = Array.isArray(result.translatedTexts)
      ? result.translatedTexts[0]
      : typeof result.translatedTexts === "string"
        ? result.translatedTexts
        : Object.values(result.translatedTexts)[0];
    const meaning = (Array.isArray(translated) ? translated[0] : translated ?? "").toString().trim();
    if (!meaning) return { status: "failed", reason: "翻訳の結果が空でした。意味は手で入力してください" };
    return { status: "ok", meaning };
  } catch (error) {
    return { status: "failed", reason: describeTranslationError(error) };
  }
}
