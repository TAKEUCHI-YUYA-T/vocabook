import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 角の丸み（既定は、完全な丸み） */
  radius?: number;
};

/**
 * Liquid Glass 風の、浮いた操作の面（戻るの丸いボタン、下の操作バー、トーストなど）
 * 半透明の白・細い縁・上の光・影で、ガラスの質感を出す。内容の面（カードや一覧）には使わない
 * Android では、背景のぼかしが重い端末があるため、ぼかさずに半透明の白だけにしている（どの端末でも同じ見た目で、読みやすい）
 */
export function GlassSurface({ children, style, radius = 999 }: Props) {
  return <View style={[styles.glass, { borderRadius: radius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    overflow: "hidden",
  },
});

export const glassStyles = StyleSheet.create({
  /** 上の縁に入れる、細い光（ガラスの縁のハイライト） */
  highlight: { position: "absolute", top: 0, left: 12, right: 12, height: 1, backgroundColor: "rgba(255,255,255,0.9)" },
});
