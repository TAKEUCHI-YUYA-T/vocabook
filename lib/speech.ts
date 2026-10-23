/**
 * 端末の読み上げ機能（expo-speech）で、英語を読み上げる（通信も費用もかからない）
 *
 * 部品（ネイティブ）は、使うときに初めて読み込む。含まれていない版のアプリでは、
 * 読み込みに失敗するので、その場合は「使えない」として、ボタンを出さない（アプリは落ちない）
 */
type SpeechModule = Pick<typeof import("expo-speech"), "speak" | "stop">;

/** 読み上げる言語。英語の単語・例文を、アメリカ英語で読む */
export const SPEECH_LANGUAGE = "en-US";
/** 読み上げの速さ（1 が標準）。単語は聞き取りやすいよう、少しゆっくり */
export const SPEECH_RATE = 0.9;

let cached: SpeechModule | null | undefined;

/** 読み上げの部品を取り出す。使えなければ null（テストでは、差し替えられる） */
export function loadSpeech(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-speech") as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** テスト用に、読み込みの結果を差し替える（undefined に戻すと、読み込み直す） */
export function setSpeechModuleForTest(module: SpeechModule | null | undefined): void {
  cached = module;
}

export const isSpeechAvailable = (): boolean => loadSpeech() !== null;

/** 読み上げる前に、前の読み上げを止めて、英語で読む。使えなければ何もしない。読み上げに失敗しても、例外にしない */
export function speakEnglish(text: string, rate: number = SPEECH_RATE): void {
  const speech = loadSpeech();
  const trimmed = text.trim();
  if (!speech || !trimmed) return;
  try {
    speech.stop();
    speech.speak(trimmed, { language: SPEECH_LANGUAGE, rate });
  } catch (error) {
    console.warn("[speech] 読み上げに失敗:", error);
  }
}

export function stopSpeaking(): void {
  try {
    loadSpeech()?.stop();
  } catch {
    // 止められなくても問題ない
  }
}
