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
  | { status: "failed"; reason: string; /** 原因の特定用に、元のエラーの本文を残す */ detail: string };

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

/** 元のエラーの本文（コードと文言）。長すぎないよう切る */
export function describeRawError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return `${code ? code + ": " : ""}${message}`.slice(0, 300);
}

/**
 * エラーを、ユーザーに見せる短い理由にする
 * subject は、翻訳の代わりに手で入力してほしい欄の名前（意味、訳）
 */
export function describeTranslationError(error: unknown, subject: string = "意味"): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "TIMEOUT") return "翻訳に時間がかかっています。通信状態を確認して、もう一度試してください";
  if (/Cannot find native module/i.test(message)) return `この版のアプリは、翻訳に対応していません。アプリを更新してください。${subject}は手で入力できます`;
  // 通信が必要だと案内するのは、モデルの取得の失敗と、通信そのもののエラーに限る（それ以外の失敗を、通信のせいにしない）
  if (/MODEL_DOWNLOAD_FAILED|UnknownHostException|Unable to resolve host|Network is unreachable|SocketTimeoutException|ConnectException/i.test(message)) {
    return "翻訳のデータを取得できませんでした。初回だけ、通信が必要です（約30MB）";
  }
  return `翻訳できませんでした。${subject}は手で入力してください`;
}

/** 英語を日本語に訳した下書き（意味・例文の訳で共通） */
export type TranslationDraft =
  | { status: "ok"; text: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string; /** 原因の特定用に、元のエラーの本文を残す */ detail: string };

/**
 * 英語の文字列を、日本語に訳した下書きを作る
 * 日本語の文字を含む場合や、英字を含まない場合は、翻訳しない
 * subject は、失敗したときに「手で入力してください」と案内する欄の名前
 */
export async function draftJapanese(text: string, translate: TranslateFn, subject: string, timeoutMs: number = DRAFT_TIMEOUT_MS): Promise<TranslationDraft> {
  if (!text.trim()) return { status: "skipped", reason: "文字が空です" };
  if (looksJapanese(text)) return { status: "skipped", reason: `日本語の文字を含むため、${subject}の下書きは作りません` };
  if (!/[A-Za-z]/.test(text)) return { status: "skipped", reason: `英字を含まないため、${subject}の下書きは作りません` };

  try {
    const result = await withTimeout(translate({ input: text, sourceLangCode: "en", targetLangCode: "ja" }), timeoutMs);
    const translated = Array.isArray(result.translatedTexts)
      ? result.translatedTexts[0]
      : typeof result.translatedTexts === "string"
        ? result.translatedTexts
        : Object.values(result.translatedTexts)[0];
    const japanese = (Array.isArray(translated) ? translated[0] : translated ?? "").toString().trim();
    if (!japanese) return { status: "failed", reason: `翻訳の結果が空でした。${subject}は手で入力してください`, detail: "empty result" };
    return { status: "ok", text: japanese };
  } catch (error) {
    return { status: "failed", reason: describeTranslationError(error, subject), detail: describeRawError(error) };
  }
}

/**
 * 英語の単語・熟語から、日本語の意味の下書きを作る
 * 日本語の文字を含む場合は、翻訳しない（英語の単語帳に入れる対象ではないため）
 */
export async function draftMeaning(text: string, translate: TranslateFn, timeoutMs: number = DRAFT_TIMEOUT_MS): Promise<DraftResult> {
  const result = await draftJapanese(text, translate, "意味", timeoutMs);
  return result.status === "ok" ? { status: "ok", meaning: result.text } : result;
}

/** 英語の例文から、日本語の訳の下書きを作る */
export function draftExampleTranslation(example: string, translate: TranslateFn, timeoutMs: number = DRAFT_TIMEOUT_MS): Promise<TranslationDraft> {
  return draftJapanese(example, translate, "訳", timeoutMs);
}
