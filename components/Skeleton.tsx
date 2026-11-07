import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "./theme";

/** 読み込みが、この時間（ミリ秒）より長引いたときだけ、灰色の形を出す（一瞬で終わるときに、ちらつかせない） */
export const SKELETON_DELAY_MS = 150;

/** active の間、delayMs を過ぎてから true になる。active が false になれば、すぐ false に戻る */
export function useShowAfter(active: boolean, delayMs: number = SKELETON_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return active && shown;
}

/** 端末の「視覚効果を減らす」がオンかどうか（オンなら、明滅させない） */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduce(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/**
 * 読み込み中の、灰色の箱。ゆっくり明滅する（視覚効果を減らす設定がオンなら、止める）
 * 読み上げには含めない。読み込み中であることは、囲む側（SkeletonGroup）が1回だけ伝える
 */
export function SkeletonBox({ width = "100%", height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);
  return <Animated.View importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: radius, backgroundColor: colors.fill, opacity }, style]} />;
}

/** 読み込み中の形をまとめる枠。スクリーンリーダーには、「読み込み中」と1回だけ伝える */
export function SkeletonGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityLabel="読み込み中" accessibilityState={{ busy: true }} style={style}>
      {children}
    </View>
  );
}

/** 単語の一覧の、1行ぶんの形 */
export function SkeletonRow({ divider = true }: { divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <SkeletonBox width={110} height={16} />
      <SkeletonBox width="70%" height={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder },
});

/**
 * 読み込み中の形を出す場所。場所（height）は最初から確保して、読み込みが終わっても、画面がずれないようにする
 * active の間、SKELETON_DELAY_MS を過ぎてから、children（灰色の箱）を出す
 */
export function SkeletonSlot({ active, height, children, style, groupStyle }: { active: boolean; height: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; groupStyle?: StyleProp<ViewStyle> }) {
  const show = useShowAfter(active);
  return <View style={[{ minHeight: height }, style]}>{show ? <SkeletonGroup style={groupStyle}>{children}</SkeletonGroup> : null}</View>;
}
