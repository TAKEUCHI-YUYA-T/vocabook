import { isSpeechAvailable, pickEnglishVoice, setSpeechModuleForTest, SPEECH_LANGUAGE, speakEnglish, stopSpeaking } from "../speech";

describe("英語の声の選び方", () => {
  it("言語は、地域なしの en で渡す（en-US は、端末の既定の言語で読まれてしまうため）", () => {
    expect(SPEECH_LANGUAGE).toBe("en");
  });

  it("米国の英語の声を選ぶ。同じ地域なら、端末内の声（通信が要らない）を優先する", () => {
    const voices = [
      { identifier: "ja-jp-x-htm-local", language: "ja-JP" },
      { identifier: "en-gb-x-gba-local", language: "en-GB" },
      { identifier: "en-us-x-tpc-network", language: "en-US" },
      { identifier: "en-us-x-sfg-local", language: "en-US" },
    ];
    expect(pickEnglishVoice(voices)).toBe("en-us-x-sfg-local");
  });

  it("米国の声がなければ、ほかの英語の声。英語の声がなければ、指定しない", () => {
    expect(pickEnglishVoice([{ identifier: "ja", language: "ja-JP" }, { identifier: "gb", language: "en_GB" }])).toBe("gb");
    expect(pickEnglishVoice([{ identifier: "ja", language: "ja-JP" }])).toBeUndefined();
    expect(pickEnglishVoice([])).toBeUndefined();
  });

  it("英語の声が見つかったら、次からは、その声で読む", async () => {
    const speak = jest.fn();
    setSpeechModuleForTest({
      stop: jest.fn(async () => {}),
      speak,
      getAvailableVoicesAsync: async () => [{ identifier: "en-us-x-sfg-local", language: "en-US" }],
    });
    speakEnglish("first");
    await Promise.resolve();
    await Promise.resolve();
    speakEnglish("second");
    expect(speak.mock.calls[0][1]).toEqual({ language: "en", rate: 0.9 });
    expect(speak.mock.calls[1][1]).toEqual({ language: "en", rate: 0.9, voice: "en-us-x-sfg-local" });
  });
});

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
