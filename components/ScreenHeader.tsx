import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { GlassIconButton } from "./GlassButton";
import type { IconName } from "./Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

type Props = {
  title: string;
  subtitle?: string;
  /** 戻る操作。指定しなければ、戻るボタンを出さない */
  onBack?: () => void;
  /** 戻るボタンの読み上げ名（スクリーンリーダー用） */
  backLabel?: string;
  /** 戻るボタンの横に出す、戻り先の名前（iOS のように「‹ ホーム」と出す）。省略すれば、矢印だけ */
  backText?: string;
  /** "close" なら「キャンセル」、省略すれば ‹ */
  backIcon?: "back" | "close";
  /** 右端に置くもの（保存ボタン、メニューなど） */
  right?: React.ReactNode;
  /** 下に線を引くか */
  bordered?: boolean;
  /** 一覧・ホームのように、大きな見出し（34px）を、左上に出す（中央の見出しは出さない） */
  large?: boolean;
};

/**
 * 画面の上部（Apple 風）
 * 左に戻る（‹ 戻り先の名前）、中央に見出し、右に操作。large のときは、下に大きな見出し
 */
export function ScreenHeader({ title, subtitle, onBack, backLabel = "戻る", backText, backIcon = "back", right, bordered, large }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ paddingTop: insets.top, backgroundColor: colors.background }, bordered && styles.bordered]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {onBack ? <GlassIconButton icon={backIcon === "close" ? "x" : "chevron-left"} label={backLabel} onPress={onBack} iconSize={backIcon === "close" ? 20 : 22} /> : null}
        </View>
        {!large && (
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
      {large && (
        <View style={styles.largeBox}>
          <Text style={styles.largeTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

/** ヘッダーの右端に置く、アイコンだけのボタン（ガラスの丸いボタン） */
export function HeaderIconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <GlassIconButton icon={icon} label={label} onPress={onPress} />;
}

/**
 * ヘッダーの右端に置く、「保存」「編集」などのボタン
 * 保存は、緑の丸いボタン（✓）。編集は、ガラスの丸いボタン（鉛筆）。ほかは、文字のボタン
 */
export function HeaderTextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  if (label === "保存") return <GlassIconButton icon="check" label={label} onPress={onPress} disabled={disabled} tone="primary" iconSize={22} />;
  if (label === "編集") return <GlassIconButton icon="pencil" label={label} onPress={onPress} disabled={disabled} iconSize={20} />;
  return (
    <TouchableOpacity accessibilityRole="button" style={[styles.textButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  bordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder },
  side: { minWidth: 56, flexDirection: "row", alignItems: "center", gap: 8 },
  sideRight: { justifyContent: "flex-end", flex: 0 },
  titleBox: { flex: 1, alignItems: "center" },
  title: { fontSize: 17, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 13, color: colors.secondary },
  largeBox: { paddingHorizontal: 16, paddingBottom: 6 },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "bold", color: colors.text },
  textButton: { minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  textButtonLabel: { color: colors.primary, fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
