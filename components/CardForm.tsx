import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { LIMITS } from "@/db/repository";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/db/types";

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
};

/**
 * 単語の入力フォーム（追加・編集で共通）
 * 必須は「単語」と「意味」だけ。品詞・例文・メモは「詳細」に折りたたむ
 */
export function CardForm({ value, onChange, editable, duplicateWarning, autoFocus }: Props) {
  const meaningRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const hasDetails = !!(value.partOfSpeech || value.example || value.exampleTranslation || value.note);
  const [showDetails, setShowDetails] = useState(hasDetails);

  const set = <K extends keyof CardFormValue>(key: K, next: CardFormValue[K]) => onChange({ ...value, [key]: next });

  return (
    <View>
      <Text style={styles.label}>
        単語<Text style={styles.required}>（必須）</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={value.term}
        onChangeText={(text) => set("term", text)}
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
      {!!duplicateWarning && <Text style={styles.warning}>{duplicateWarning}</Text>}

      <Text style={styles.label}>
        意味<Text style={styles.required}>（必須）</Text>
      </Text>
      <TextInput
        ref={meaningRef}
        style={[styles.input, styles.multiline]}
        value={value.meaning}
        onChangeText={(text) => set("meaning", text)}
        editable={editable}
        multiline
        maxLength={LIMITS.meaning}
        placeholder="例: 廃止する"
      />

      {/* 詳細（品詞・例文・メモ）。入力済みなら最初から開いておく */}
      {showDetails || hasDetails ? (
        <>
          <Text style={styles.label}>品詞</Text>
          <View style={styles.chips}>
            {PARTS_OF_SPEECH.map((part) => {
              const selected = value.partOfSpeech === part.key;
              return (
                <TouchableOpacity
                  key={part.key}
                  disabled={!editable}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => set("partOfSpeech", selected ? null : part.key)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{part.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>例文</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={value.example}
            onChangeText={(text) => set("example", text)}
            editable={editable}
            multiline
            autoCapitalize="sentences"
            maxLength={LIMITS.example}
          />

          <Text style={styles.label}>例文の訳</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={value.exampleTranslation}
            onChangeText={(text) => set("exampleTranslation", text)}
            editable={editable}
            multiline
            maxLength={LIMITS.example}
          />

          <Text style={styles.label}>メモ</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={value.note}
            onChangeText={(text) => set("note", text)}
            editable={editable}
            multiline
            maxLength={LIMITS.note}
          />
        </>
      ) : (
        <TouchableOpacity style={styles.detailsToggle} onPress={() => setShowDetails(true)}>
          <Text style={styles.detailsToggleText}>＋ 品詞・例文・メモを入力する</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: "600", color: "#446158", marginTop: 12, marginBottom: 4 },
  required: { fontSize: 13, fontWeight: "normal", color: "#ff5757" },
  input: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 12, fontSize: 18, backgroundColor: "white", color: "black" },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  warning: { fontSize: 14, color: "#b26a00", marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "gray", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: "#9fd700", borderColor: "#9fd700" },
  chipText: { fontSize: 15, color: "black" },
  chipTextSelected: { color: "white", fontWeight: "bold" },
  detailsToggle: { marginTop: 16, paddingVertical: 8 },
  detailsToggleText: { fontSize: 16, color: "#446158", fontWeight: "600" },
});
