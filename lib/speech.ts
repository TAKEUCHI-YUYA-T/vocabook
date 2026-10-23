/**
 * 端末の読み上げ機能（expo-speech）で、英語を読み上げる（通信も費用もかからない）
 *
 * 部品（ネイティブ）は、使うときに初めて読み込む。含まれていない版のアプリでは、
 * 読み込みに失敗するので、その場合は「使えない」として、ボタンを出さない（アプリは落ちない）
 */
type SpeechModule = Pick<typeof import("expo-speech"), "speak" | "stop"> & {
  getAvailableVoicesAsync?: () => Promise<{ identifier: string; language: string }[]>;
};

/**
 * 読み上げる言語。Android の部品は、この値を言語コードとして読み、"en-US" のような地域つきの値は、
 * 不正として端末の既定の言語（日本語）で読んでしまう。そのため言語は "en" とし、米国の声は voice で指定する
 */
export const SPEECH_LANGUAGE = "en";
/** 読み上げの速さ（1 が標準）。単語は聞き取りやすいよう、少しゆっくり */
export const SPEECH_RATE = 0.9;

let cached: SpeechModule | null | undefined;
let voiceLookup: Promise<void> | null = null;
let englishVoice: string | undefined;

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
  voiceLookup = null;
  englishVoice = undefined;
}

export const isSpeechAvailable = (): boolean => loadSpeech() !== null;

/**
 * 端末の声から、英語の声を選ぶ。米国 → 英国など、ほかの英語 の順。同じ地域なら、端末内の声（通信が要らない）を優先する
 * 英語の声がなければ undefined（言語の指定だけで読む）
 */
export function pickEnglishVoice(voices: { identifier: string; language: string }[]): string | undefined {
  const lang = (voice: { language: string }) => voice.language.toLowerCase().replace("_", "-");
  const score = (voice: { identifier: string; language: string }) => {
    const l = lang(voice);
    const region = l === "en-us" ? 0 : l.startsWith("en") ? 1 : 9;
    const offline = /network/i.test(voice.identifier) ? 1 : 0;
    return region * 2 + offline;
  };
  const english = voices.filter((voice) => lang(voice).startsWith("en")).sort((a, b) => score(a) - score(b));
  return english[0]?.identifier;
}

/** 英語の声を、最初の1回だけ探しておく（見つかるまでは、言語の指定だけで読む） */
function prepareVoice(speech: SpeechModule): void {
  if (voiceLookup || !speech.getAvailableVoicesAsync) return;
  voiceLookup = speech
    .getAvailableVoicesAsync()
    .then((voices) => {
      englishVoice = pickEnglishVoice(voices);
    })
    .catch(() => {
      // 声の一覧が取れなくても、言語の指定だけで読める
    });
}

/** 読み上げる前に、前の読み上げを止めて、英語で読む。使えなければ何もしない。読み上げに失敗しても、例外にしない */
export function speakEnglish(text: string, rate: number = SPEECH_RATE): void {
  const speech = loadSpeech();
  const trimmed = text.trim();
  if (!speech || !trimmed) return;
  prepareVoice(speech);
  try {
    speech.stop();
    speech.speak(trimmed, { language: SPEECH_LANGUAGE, rate, ...(englishVoice ? { voice: englishVoice } : {}) });
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
