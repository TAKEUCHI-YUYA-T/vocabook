import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { GlassSurface } from "./GlassSurface";
import { Icon, type IconName } from "./Icon";
import { colors } from "./theme";

type Props = {
  icon: IconName;
  /** 読み上げ名（スクリーンリーダー用） */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** "primary" は、緑の地に白い記号（その画面の、主な操作。保存など）。"glass" は、ガラスに黒い記号 */
  tone?: "glass" | "primary";
  size?: number;
  iconSize?: number;
};

/** 丸いボタン（Liquid Glass 風）。画面の左上の「戻る」、右上の操作などに使う。押せる大きさは 44px 以上 */
export function GlassIconButton({ icon, label, onPress, disabled, tone = "glass", size = 44, iconSize = 22 }: Props) {
  const primary = tone === "primary";
  const button = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      activeOpacity={0.6}
      style={[styles.touch, { width: size, height: size, borderRadius: size / 2 }, primary && styles.primary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Icon name={icon} size={iconSize} color={primary ? colors.onPrimary : colors.text} />
    </TouchableOpacity>
  );
  // 主な操作は、緑の地（ガラスにしない）。それ以外は、ガラスの面に載せる
  return primary ? button : <GlassSurface style={{ width: size, height: size }}>{button}</GlassSurface>;
}

const styles = StyleSheet.create({
  touch: { alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  disabled: { opacity: 0.4 },
});
