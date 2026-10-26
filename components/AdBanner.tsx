import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { BANNER_HEIGHT } from "@/lib/adConfig";
import { bannerUnitId, startAds } from "@/lib/ads";
import { colors } from "./theme";

/**
 * バナー広告（画面の上に置く）
 * - 画面の下には、ボタン（誤タップしやすい）があるので、置かない
 * - 広告が出る場所は、先に確保しておく（広告が出たときに、下の内容がずれて、誤タップにならないように）
 * - 広告を出せないとき（同意が得られない、通信がない）は、場所ごと閉じる
 */
export function AdBanner() {
  const [canShow, setCanShow] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    startAds().then((ok) => active && setCanShow(ok));
    return () => {
      active = false;
    };
  }, []);

  if (canShow === false || failed) return null;
  return (
    <View style={styles.slot} accessibilityLabel="広告">
      {canShow && (
        <BannerAd
          unitId={bannerUnitId}
          size={BannerAdSize.BANNER}
          onAdFailedToLoad={(error) => {
            console.warn("[ads] 広告を読み込めませんでした:", error);
            setFailed(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: BANNER_HEIGHT + 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
