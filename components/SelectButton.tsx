import React, { useState } from "react";
import { Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./theme";

export type SelectOption = { key: string; label: string };

type Props = {
  /** 選ぶ項目の名前（読み上げ用、選択肢の画面の見出しにも使う） */
  title: string;
  /** いま選んでいる項目の表示。何も選んでいなければ placeholder */
  value: string | null;
  placeholder?: string;
  options: SelectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

/** 選択肢から1つ選ぶボタン。押すと、画面の下から選択肢の一覧が出る（ドロップダウンの代わり） */
export function SelectButton({ title, value, placeholder = "選んでください", options, selectedKey, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value ?? placeholder}`}
        style={styles.button}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.value, value === null && styles.placeholder]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.primary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="閉じる">
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView style={styles.list}>
              {options.map((option) => {
                const selected = option.key === selectedKey;
                return (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={styles.option}
                    onPress={() => {
                      setOpen(false);
                      onSelect(option.key);
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    {selected && <Feather name="check" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 130,
    maxWidth: 190,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.fillStrong,
  },
  value: { flexShrink: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.warning },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingHorizontal: 16, maxHeight: "70%" },
  sheetTitle: { fontSize: 13, fontWeight: "600", color: colors.secondary, marginBottom: 8, paddingHorizontal: 4 },
  list: { flexGrow: 0 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { flex: 1, fontSize: 17, color: colors.text },
  optionTextSelected: { fontWeight: "600", color: colors.primary },
});
