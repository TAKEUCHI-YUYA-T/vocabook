import { BANNER_HEIGHT, pickBannerUnitId } from "../adConfig";

describe("広告ユニット ID の選び方", () => {
  const testId = "ca-app-pub-3940256099942544/6300978111";
  const productionId = "ca-app-pub-1234567890123456/1111111111";

  it("本番の ID があるリリースビルドだけ、本番の広告を出す", () => {
    expect(pickBannerUnitId({ isDev: false, productionId, testId })).toBe(productionId);
  });

  it("開発中は、本番の ID があっても、テスト広告にする（自分の広告を押して、アカウントが止められないように）", () => {
    expect(pickBannerUnitId({ isDev: true, productionId, testId })).toBe(testId);
  });

  it("本番の ID が未設定・空なら、リリースビルドでも、テスト広告にする", () => {
    expect(pickBannerUnitId({ isDev: false, productionId: undefined, testId })).toBe(testId);
    expect(pickBannerUnitId({ isDev: false, productionId: "  ", testId })).toBe(testId);
  });

  it("バナーの高さは、標準サイズ（320×50）の 50", () => {
    expect(BANNER_HEIGHT).toBe(50);
  });
});
