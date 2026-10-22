import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LIMITS } from "@/db/repository";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/db/types";
import { colors } from "./theme";

export type CardFormValue = {
  term: string;
  meaning: string;
  partOfSpeech: PartOfSpeech | null;
  example: string;
  exampleTranslation: string;
  note: string;
};

export const emptyCardForm = (partOfSpeech: PartOfSpeech | null = null): CardFormValue => ({
  term: "",
  meaning: "",
  partOfSpeech,
  example: "",
  exampleTranslation: "",
  note: "",
});

type Props = {
  value: CardFormValue;
  onChange: (value: CardFormValue) => void;
  editable: boolean;
  /** 同じ単語がすでにあるときの警告（保存は止めない） */
  duplicateWarning?: string | null;
  autoFocus?: boolean;
  /** 品詞・例文・メモを、最初から開いておく（編集画面） */
  expanded?: boolean;
  /** 意味の欄の名前の横に出す札（例: 自動翻訳の下書き） */
  meaningBadge?: string | null;
  /** 意味の欄の下に出す案内 */
  meaningHint?: string | null;
};

/**
 * 単語の入力フォーム（追加・編集・他のアプリから登録で共通）
 * 必須は「単語」と「意味」だけ。品詞・例文・メモは「詳細」に折りたたむ
 */
export function CardForm({ value, onChange, editable, duplicateWarning, autoFocus, expanded, meaningBadge, meaningHint }: Props) {
  const meaningRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const hasDetails = !!(value.partOfSpeech || value.example || value.exampleTranslation || value.note);
  const [showDetails, setShowDetails] = useState(hasDetails);
  const [termFocused, setTermFocused] = useState(false);

  const set = <K extends keyof CardFormValue>(key: K, next: CardFormValue[K]) => onChange({ ...value, [key]: next });

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.label}>単語（必須）</Text>
        <TextInput
          style={[styles.termInput, termFocused && styles.termInputFocused]}
          value={value.term}
          onChangeText={(text) => set("term", text)}
          onFocus={() => setTermFocused(true)}
          onBlur={() => setTermFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={LIMITS.term}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => meaningRef.current?.focus()}
          placeholder="例: abolish"
        />
      </View>

      {!!duplicateWarning && (
        <View style={styles.warning} accessibilityRole="alert">
          <Feather name="alert-circle" size={18} color={colors.warningText} style={styles.warningIcon} />
          <Text style={styles.warningText}>{duplicateWarning}</Text>
        </View>
      )}

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>意味（必須）</Text>
          {!!meaningBadge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{meaningBadge}</Text>
            </View>
          )}
        </View>
        <TextInput
          ref={meaningRef}
          style={[styles.input, styles.multiline, styles.meaningInput]}
          value={value.meaning}
          onChangeText={(text) => set("meaning", text)}
          editable={editable}
          multiline
          maxLength={LIMITS.meaning}
          placeholder="例: 廃止する"
        />
        {!!meaningHint && <Text style={styles.hint}>{meaningHint}</Text>}
      </View>

      {/* 詳細（品詞・例文・メモ）。編集画面や、入力済みなら最初から開いておく */}
      {expanded || showDetails || hasDetails ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>品詞</Text>
            <View style={styles.chips}>
              {PARTS_OF_SPEECH.map((part) => {
                const selected = value.partOfSpeech === part.key;
                return (
                  <TouchableOpacity
                    key={part.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={!editable}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => set("partOfSpeech", selected ? null : part.key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{part.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>例文</Text>
            <TextInput
              style={[styles.input, styles.multiline, styles.detailInput]}
              value={value.example}
              onChangeText={(text) => set("example", text)}
              editable={editable}
              multiline
              autoCapitalize="sentences"
              maxLength={LIMITS.example}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>例文の訳</Text>
            <TextInput
              style={[styles.input, styles.multiline, styles.detailInput]}
              value={value.exampleTranslation}
              onChangeText={(text) => set("exampleTranslation", text)}
              editable={editable}
              multiline
              maxLength={LIMITS.example}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>メモ</Text>
            <TextInput
              style={[styles.input, styles.multiline, styles.detailInput]}
              value={value.note}
              onChangeText={(text) => set("note", text)}
              editable={editable}
              multiline
              maxLength={LIMITS.note}
              placeholder="覚え方、使い分けなど"
            />
          </View>
        </>
      ) : (
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: false }} style={styles.detailsToggle} onPress={() => setShowDetails(true)}>
          <Feather name="plus" size={20} color={colors.secondary} />
          <Text style={styles.detailsToggleText}>品詞・例文・メモを入力する</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "bold", color: colors.secondary },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { backgroundColor: colors.panel, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontSize: 12, fontWeight: "bold", color: colors.secondary },
  hint: { fontSize: 13, fontWeight: "500", color: colors.secondary },
  termInput: {
    height: 58,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: "bold",
    backgroundColor: colors.surface,
    color: colors.text,
  },
  termInputFocused: { borderWidth: 2, borderColor: colors.secondary },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, color: colors.text },
  multiline: { textAlignVertical: "top" },
  meaningInput: { minHeight: 96, fontSize: 17 },
  detailInput: { minHeight: 64, fontSize: 15 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.panel, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: -8 },
  warningIcon: { marginTop: 2 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.warningText },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { fontWeight: "bold", color: colors.onPrimary },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 4 },
  detailsToggleText: { fontSize: 16, fontWeight: "bold", color: colors.secondary },
});
