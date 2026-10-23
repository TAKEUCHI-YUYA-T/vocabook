import { isSpeechAvailable, setSpeechModuleForTest, SPEECH_LANGUAGE, speakEnglish, stopSpeaking } from "../speech";

afterEach(() => setSpeechModuleForTest(undefined));

describe("読み上げ", () => {
  it("前の読み上げを止めてから、英語で読む（前後の空白は除く）", () => {
    const calls: string[] = [];
    setSpeechModuleForTest({
      stop: jest.fn(async () => {
        calls.push("stop");
      }),
      speak: jest.fn((text: string, options?: { language?: string; rate?: number }) => {
        calls.push(`speak:${text}:${options?.language}:${options?.rate}`);
      }),
    });
    speakEnglish("  abolish ");
    expect(isSpeechAvailable()).toBe(true);
    expect(calls).toEqual(["stop", `speak:abolish:${SPEECH_LANGUAGE}:0.9`]);
  });

  it("空の文字は読まない。部品が無い版のアプリでは、何もせず、使えないと答える", () => {
    const speak = jest.fn();
    setSpeechModuleForTest({ stop: jest.fn(async () => {}), speak });
    speakEnglish("   ");
    expect(speak).not.toHaveBeenCalled();

    setSpeechModuleForTest(null);
    expect(isSpeechAvailable()).toBe(false);
    expect(() => speakEnglish("abolish")).not.toThrow();
    expect(() => stopSpeaking()).not.toThrow();
  });

  it("読み上げが失敗しても、例外にしない", () => {
    setSpeechModuleForTest({
      stop: jest.fn(async () => {}),
      speak: jest.fn(() => {
        throw new Error("音声エンジンなし");
      }),
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => speakEnglish("abolish")).not.toThrow();
    warn.mockRestore();
  });
});
