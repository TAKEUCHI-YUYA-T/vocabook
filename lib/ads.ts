import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, MaxAdContentRating, TestIds } from "react-native-google-mobile-ads";
import { pickBannerUnitId } from "./adConfig";

/**
 * 広告（Google AdMob）の準備
 * 1. 同意が必要な地域（欧州など）の利用者にだけ、Google の同意の画面を出す（日本では出ない）
 * 2. 広告を出してよいと分かってから、広告の部品を初期化する
 * 対象年齢は 13 歳以上（通常の広告。内容は、13 歳以上向けまで）
 */

/** バナー広告のユニット ID（本番の ID は、ビルド時の環境変数 EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID で渡す） */
export const bannerUnitId = pickBannerUnitId({
  isDev: __DEV__,
  productionId: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID,
  testId: TestIds.BANNER,
});

let started: Promise<boolean> | null = null;

/** 広告の準備を始める（何度呼んでも、準備は1回だけ）。広告を出してよければ true */
export function startAds(): Promise<boolean> {
  started ??= (async () => {
    try {
      await AdsConsent.gatherConsent();
      const info = await AdsConsent.getConsentInfo();
      if (!info.canRequestAds) return false;
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await mobileAds().initialize();
      return true;
    } catch (error) {
      // 広告の準備に失敗しても、アプリは、広告なしで使える
      console.warn("[ads] 広告を準備できませんでした:", error);
      return false;
    }
  })();
  return started;
}

/** 同意の設定を、利用者がやり直せるようにする必要があるか（同意が必要な地域だけ true） */
export async function privacyOptionsRequired(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

/** 同意の設定の画面を出す */
export async function showPrivacyOptions(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (error) {
    console.warn("[ads] 同意の設定を開けませんでした:", error);
  }
}
