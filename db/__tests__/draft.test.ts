import { describeTranslationError, draftExampleTranslation, draftMeaning, type TranslateFn } from "../draft";

const ok = (text: string): TranslateFn => async () => ({ translatedTexts: text, sourceLanguage: "en" });

describe("意味の下書き", () => {
  it("英語の単語を翻訳して、前後の空白を取り除いた意味を返す", async () => {
    expect(await draftMeaning("apple", ok("  りんご \n"))).toEqual({ status: "ok", meaning: "りんご" });
  });

  it("英語から日本語へ、固定の言語指定で翻訳を呼ぶ", async () => {
    const translate = jest.fn(ok("りんご"));
    await draftMeaning("apple", translate);
    expect(translate).toHaveBeenCalledWith({ input: "apple", sourceLangCode: "en", targetLangCode: "ja" });
  });

  it("翻訳が配列やオブジェクトで返っても、最初の1つを使う", async () => {
    expect(await draftMeaning("a", async () => ({ translatedTexts: ["一つ目", "二つ目"], sourceLanguage: "en" }))).toMatchObject({ meaning: "一つ目" });
    expect(await draftMeaning("a", async () => ({ translatedTexts: { k: "値" }, sourceLanguage: "en" }))).toMatchObject({ meaning: "値" });
  });

  it("日本語の文字を含む入力や、空の入力は、翻訳を呼ばない", async () => {
    const translate = jest.fn(ok("x"));
    expect((await draftMeaning("りんご", translate)).status).toBe("skipped");
    expect((await draftMeaning("   ", translate)).status).toBe("skipped");
    expect(translate).not.toHaveBeenCalled();
  });

  it("翻訳が失敗しても例外を投げず、理由つきの結果を返す", async () => {
    const result = await draftMeaning("apple", async () => {
      throw new Error("MODEL_DOWNLOAD_FAILED: network");
    });
    expect(result).toEqual({
      status: "failed",
      reason: "翻訳のデータを取得できませんでした。初回だけ、通信が必要です（約30MB）",
      detail: "MODEL_DOWNLOAD_FAILED: network",
    });
  });

  it("翻訳の部品が入っていない版のアプリでは、更新を促す理由を返す", async () => {
    const result = await draftMeaning("apple", async () => {
      throw new Error("Cannot find native module 'ExpoTranslateText'");
    });
    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("アプリを更新してください");
  });

  it("結果が空なら、失敗として扱う", async () => {
    expect((await draftMeaning("apple", ok("   "))).status).toBe("failed");
  });

  it("時間がかかりすぎたら、待つのをやめる", async () => {
    const never: TranslateFn = () => new Promise(() => {});
    const result = await draftMeaning("apple", never, 20);
    expect(result).toEqual({ status: "failed", reason: describeTranslationError(new Error("TIMEOUT")), detail: "TIMEOUT" });
    expect(result.status === "failed" && result.reason).toContain("時間がかかっています");
  });
});

describe("例文の訳の下書き", () => {
  it("英語の例文を、英語から日本語へ訳す", async () => {
    const translate = jest.fn(ok(" 私はその案に賛成です。 "));
    expect(await draftExampleTranslation("I agree with the plan.", translate)).toEqual({ status: "ok", text: "私はその案に賛成です。" });
    expect(translate).toHaveBeenCalledWith({ input: "I agree with the plan.", sourceLangCode: "en", targetLangCode: "ja" });
  });

  it("日本語を含む例文や、英字のない例文は、訳さない", async () => {
    const translate = jest.fn(ok("x"));
    expect((await draftExampleTranslation("彼は来た。", translate)).status).toBe("skipped");
    expect((await draftExampleTranslation("123 456", translate)).status).toBe("skipped");
    expect(translate).not.toHaveBeenCalled();
  });

  it("失敗したら、訳は手で入力するよう案内する（意味の案内とは文言を分ける）", async () => {
    const result = await draftExampleTranslation("I agree.", async () => {
      throw new Error("PARAMETER_ERROR: something");
    });
    expect(result).toEqual({ status: "failed", reason: "翻訳できませんでした。訳は手で入力してください", detail: "PARAMETER_ERROR: something" });
  });
});

describe("エラーの本文", () => {
  it("コードがあればコードつきで、長すぎる本文は切って返す", async () => {
    const { describeRawError } = await Promise.resolve(require("../draft"));
    const coded = Object.assign(new Error("download failed"), { code: "MODEL_DOWNLOAD_FAILED" });
    expect(describeRawError(coded)).toBe("MODEL_DOWNLOAD_FAILED: download failed");
    expect(describeRawError(new Error("x".repeat(1000))).length).toBe(300);
    expect(describeRawError("文字列のエラー")).toBe("文字列のエラー");
  });
});

describe("失敗の理由の判定", () => {
  it("通信が必要だと案内するのは、モデルの取得の失敗と、通信そのもののエラーだけ", () => {
    const network = "翻訳のデータを取得できませんでした。初回だけ、通信が必要です（約30MB）";
    expect(describeTranslationError(new Error("MODEL_DOWNLOAD_FAILED: x"))).toBe(network);
    expect(describeTranslationError(new Error("java.net.UnknownHostException: Unable to resolve host"))).toBe(network);
    // 今回の実際のエラー（Kotlin への変換の失敗）は、通信とは無関係
    const conversion = new Error("ERR_UNEXPECTED: [translateTask] Cannot convert '[object Object]' to a Kotlin type. Value is undefined, expected an Object");
    expect(describeTranslationError(conversion)).toBe("翻訳できませんでした。意味は手で入力してください");
    expect(describeTranslationError(new Error("at ?anon_0_onTranslateTask (http://localhost:8081/node_modules/expo-router/entry.bundle//&platform=android&dev=true)"))).toBe(
      "翻訳できませんでした。意味は手で入力してください"
    );
  });
});
