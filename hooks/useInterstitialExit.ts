import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "expo-router";
import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { useDb } from "@/db/AppDatabase";
import { adsEnabled, interstitialUnitId, startAds } from "@/lib/ads";
import {
  MAX_WAIT_MS,
  WAIT_BEFORE_AD_MS,
  readInterstitialHistory,
  recordInterstitialShown,
  recordStudyExit,
  shouldShowInterstitial,
} from "@/lib/interstitialPolicy";

/**
 * 学習の画面を抜けるとき（左上の戻る・端末の戻る操作）に、条件を満たせば、全画面の広告を出す
 * - 画面を開いたときに、裏で広告を読み込んでおく
 * - 出すときは、「Please wait...」を 1 秒ほど見せてから、広告を出す。広告を閉じたら、行き先へ進む
 * - 広告が出せない（読み込めていない・エラー・3 秒たっても出ない）ときは、待たずに、行き先へ進む
 * 条件は lib/interstitialPolicy.ts（答えを 10 回以上見た・前の広告から 10 分以上・初めての学習ではない・読み込み済み）
 *
 * @param onExit 広告のあとに進む先（いつもの「戻る」の処理）
 * @returns countReveal 答えを見るたびに呼ぶ。requestExit 戻る操作で呼ぶ。waiting 「Please wait...」を出すか
 */
export function useInterstitialExit(onExit: () => void) {
  const db = useDb();
  const [waiting, setWaiting] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const revealsRef = useRef(0);
  const busyRef = useRef(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // 画面を開いたときに、広告を読み込んでおく（同意が済んで、広告を出してよいときだけ）
  useEffect(() => {
    if (!adsEnabled) return;
    let active = true;
    const unsubscribers: (() => void)[] = [];
    startAds().then((ok) => {
      if (!ok || !active) return;
      const ad = InterstitialAd.createForAdRequest(interstitialUnitId);
      unsubscribers.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          loadedRef.current = true;
        }),
        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          loadedRef.current = false;
          console.warn("[ads] 全画面の広告を読み込めませんでした:", error);
        })
      );
      adRef.current = ad;
      ad.load();
    });
    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      adRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  const countReveal = useCallback(() => {
    revealsRef.current += 1;
  }, []);

  const requestExit = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    let previousExits = 0;
    let show = false;
    try {
      const history = await readInterstitialHistory(db);
      previousExits = history.previousExits;
      show =
        adsEnabled &&
        shouldShowInterstitial({
          reveals: revealsRef.current,
          lastShownAt: history.lastShownAt,
          now: Date.now(),
          previousExits,
          loaded: loadedRef.current,
        });
      // 学習を抜けた回数は、広告を出す・出さないに関係なく、数える
      await recordStudyExit(db, previousExits);
    } catch (error) {
      console.warn("[ads] 広告の記録を読み書きできませんでした:", error);
    }

    const ad = adRef.current;
    if (!show || !ad) {
      busyRef.current = false;
      onExitRef.current();
      return;
    }

    setWaiting(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(giveUp);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      busyRef.current = false;
      setWaiting(false);
      onExitRef.current();
    };
    const unsubscribers = [
      ad.addAdEventListener(AdEventType.CLOSED, finish),
      ad.addAdEventListener(AdEventType.ERROR, finish),
    ];
    // 広告が出ないまま、待たせ続けない（出始めたら、閉じられるまで待つ。出る前に、3 秒たったら、広告なしで進む）
    let shown = false;
    const giveUp = setTimeout(() => {
      if (!shown) finish();
    }, MAX_WAIT_MS);
    setTimeout(() => {
      if (finished) return;
      ad.show()
        .then(() => {
          shown = true;
          return recordInterstitialShown(db, Date.now());
        })
        .catch((error) => {
          console.warn("[ads] 全画面の広告を出せませんでした:", error);
          finish();
        });
    }, WAIT_BEFORE_AD_MS);
  }, [db]);

  // 端末の戻る操作（画面の端からのスワイプを含む）も、左上の戻るボタンと同じ扱いにする
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        requestExit();
        return true;
      });
      return () => subscription.remove();
    }, [requestExit])
  );

  return { countReveal, requestExit, waiting };
}
