import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

type Props = {
  title: string;
  subtitle?: string;
  /** 戻る操作。指定しなければ、戻るボタンを出さない */
  onBack?: () => void;
  /** 戻るボタンの読み上げ名（スクリーンリーダー用） */
  backLabel?: string;
  /** "close" なら ✕、省略すれば ＜ */
  backIcon?: "back" | "close";
  /** 右端に置くもの（保存ボタン、メニューなど） */
  right?: React.ReactNode;
  /** 下に線を引くか */
  bordered?: boolean;
};

/** 画面の上部（戻るボタン・タイトル・右端の操作）。ステータスバーの高さを避けて表示する */
export function ScreenHeader({ title, subtitle, onBack, backLabel = "戻る", backIcon = "back", right, bordered }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }, bordered && styles.bordered]}>
      {onBack ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={backLabel} style={styles.iconButton} onPress={onBack}>
          <Feather name={backIcon === "close" ? "x" : "chevron-left"} size={24} color={colors.secondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.titleBox}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

/** ヘッダーの右端に置く、丸いアイコンボタン */
export function HeaderIconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton} onPress={onPress}>
      <Feather name={icon} size={22} color={colors.secondary} />
    </TouchableOpacity>
  );
}

/** ヘッダーの右端に置く、黄緑の「保存」などのボタン */
export function HeaderTextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={[styles.textButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4, backgroundColor: colors.background },
  bordered: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  spacer: { width: 8 },
  titleBox: { flex: 1 },
  title: { fontSize: 18, fontWeight: "bold", color: colors.text },
  subtitle: { fontSize: 13, color: colors.secondary },
  textButton: { height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginRight: 4 },
  textButtonLabel: { color: colors.onPrimary, fontSize: 17, fontWeight: "bold" },
  disabled: { opacity: 0.5 },
});
