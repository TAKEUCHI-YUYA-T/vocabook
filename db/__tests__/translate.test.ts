import { buildNativeParams } from "../translate";

describe("ネイティブの翻訳に渡す設定", () => {
  it("どの項目も undefined にしない（Kotlin 側が undefined を受け取れないため）", () => {
    const params = buildNativeParams({ input: "apple", sourceLangCode: "en", targetLangCode: "ja" });
    expect(Object.values(params).every((value) => value !== undefined)).toBe(true);
    expect(Object.keys(params).sort()).toEqual(["input", "preferredStrategy", "requireCharging", "requiresWifi", "sourceLangCode", "targetLangCode"]);
    expect(params).toEqual({
      input: "apple",
      sourceLangCode: "en",
      targetLangCode: "ja",
      requiresWifi: false,
      requireCharging: false,
      preferredStrategy: "lowLatency",
    });
  });

  it("呼び出し側が指定した Wi-Fi 条件は、そのまま渡す", () => {
    expect(buildNativeParams({ input: "a", sourceLangCode: "en", targetLangCode: "ja", requiresWifi: true }).requiresWifi).toBe(true);
  });
});
