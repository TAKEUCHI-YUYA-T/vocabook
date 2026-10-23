import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CardAutoFillState } from "@/db/autofill";
import { LIMITS } from "@/db/repository";
import { FLAG_LABELS, ING_OR_TO_LABELS, PARTS_OF_SPEECH, type CardFlag, type IngOrToAnswer, type PartOfSpeech } from "@/db/types";
import { SpeakButton } from "./SpeakButton";
import { colors } from "./theme";

export type CardFormValue = {
  term: string;
  meaning: string;
  partOfSpeech: PartOfSpeech | null;
  example: string;
  exampleTranslation: string;
  note: string;
  /** ing or to の問題にも出すときの答え（null なら出さない） */
  answer: IngOrToAnswer | null;
  /** 学習のフラグ（編集画面で付け外しする。追加では未設定） */
  flag: CardFlag;
};

export const emptyCardForm = (partOfSpeech: PartOfSpeech | null = null): CardFormValue => ({
  term: "",
  meaning: "",
  partOfSpeech,
  example: "",
  exampleTranslation: "",
  note: "",
  answer: null,
  flag: "",
});

/** フラグの選択肢（なし・覚えた・要復習） */
const FLAG_CHOICES: { key: CardFlag; label: string }[] = [
  { key: "", label: "フラグなし" },
  { key: "learned", label: FLAG_LABELS.learned },
  { key: "review", label: FLAG_LABELS.review },
];

/** ing or to の問題の選択肢（出さない・～ing・to～） */
const ING_OR_TO_CHOICES: { key: IngOrToAnswer | null; label: string }[] = [
  { key: null, label: "出さない" },
  { key: "ing", label: ING_OR_TO_LABELS.ing },
  { key: "to", label: ING_OR_TO_LABELS.to },
];

type Props = {
  value: CardFormValue;
  onChange: (value: CardFormValue) => void;
  editable: boolean;
  /** 同じ単語がすでにあるときの警告（保存は止めない） */
  duplicateWarning?: string | null;
  autoFocus?: boolean;
  /** 品詞・例文・メモを、最初から開いておく（編集画面） */
  expanded?: boolean;
  /** 学習のフラグの選択を出す（編集画面） */
  showFlag?: boolean;
  /** 品詞・意味・例文の訳の自動入力の状態（自動で入った値に札を出し、訳を作っている間の表示を出す） */
  autoFill?: CardAutoFillState;
};

/**
 * 単語の入力フォーム（追加・編集・他のアプリから登録で共通）
 * 必須は「単語」と「意味」だけ。品詞・例文・メモは「詳細」に折りたたむ
 */
export function CardForm({ value, onChange, editable, duplicateWarning, autoFocus, expanded, showFlag, autoFill }: Props) {
  const meaningRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const hasDetails = !!(value.partOfSpeech || value.example || value.exampleTranslation || value.note || value.answer);
  // ing or to の問題は、動詞と熟語のときに選べる（すでに選んであれば、品詞を変えても、外せるよう出しておく）
  const showIngOrTo = value.partOfSpeech === "verb" || value.partOfSpeech === "idiom" || value.answer !== null;
  const [showDetails, setShowDetails] = useState(hasDetails);
  const [termFocused, setTermFocused] = useState(false);

  // 自動で入った値のままなら、「自動の下書き」の札を出す（あなたが直したら消える）
  const isAutoPartOfSpeech = !!autoFill && value.partOfSpeech !== null && value.partOfSpeech === autoFill.autoPartOfSpeech;
  const isAutoMeaning = !!autoFill && value.meaning !== "" && value.meaning === autoFill.autoMeaning;
  const meaningStatus = autoFill?.meaningStatus;
  const isAutoTranslation = !!autoFill && value.exampleTranslation !== "" && value.exampleTranslation === autoFill.autoTranslation;
  const translationStatus = autoFill?.translationStatus;

  const set = <K extends keyof CardFormValue>(key: K, next: CardFormValue[K]) => onChange({ ...value, [key]: next });

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>単語（必須）</Text>
          <SpeakButton text={value.term} label="単語を読み上げる" />
        </View>
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
          {isAutoMeaning && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>自動翻訳の下書き</Text>
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
        {meaningStatus?.state === "loading" && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.secondary} />
            <Text style={styles.hint}>意味を調べています…（初回は、翻訳のデータを取得するため、時間がかかります）</Text>
          </View>
        )}
        {meaningStatus?.state === "failed" && !!meaningStatus.message && <Text style={styles.failure}>{meaningStatus.message}</Text>}
        {isAutoMeaning && meaningStatus?.state !== "loading" && <Text style={styles.hint}>内容を確認して、必要なら直してください。</Text>}
      </View>

      {showFlag && (
        <View style={styles.field}>
          <Text style={styles.label}>フラグ</Text>
          <View style={styles.chips}>
            {FLAG_CHOICES.map((choice) => {
              const selected = value.flag === choice.key;
              return (
                <TouchableOpacity
                  key={choice.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={!editable}
                  style={[styles.chip, selected && (choice.key === "review" ? styles.chipReview : styles.chipSelected)]}
                  onPress={() => set("flag", choice.key)}
                >
                  <Text style={[styles.chipText, selected && (choice.key === "review" ? styles.chipTextReview : styles.chipTextSelected)]}>{choice.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 詳細（品詞・例文・メモ）。編集画面や、入力済みなら最初から開いておく */}
      {expanded || showDetails || hasDetails ? (
        <>
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>品詞</Text>
              {isAutoPartOfSpeech && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>自動判定の下書き</Text>
                </View>
              )}
            </View>
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

          {showIngOrTo && (
            <View style={styles.field}>
              <Text style={styles.label}>ing or to の問題</Text>
              <View style={styles.chips}>
                {ING_OR_TO_CHOICES.map((choice) => {
                  const selected = value.answer === choice.key;
                  return (
                    <TouchableOpacity
                      key={choice.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={!editable}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => set("answer", choice.key)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{choice.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.hint}>後ろに続く形を選ぶと、ing or to の問題にも出ます。</Text>
            </View>
          )}

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>例文</Text>
              <SpeakButton text={value.example} label="例文を読み上げる" />
            </View>
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
            <View style={styles.labelRow}>
              <Text style={styles.label}>例文の訳</Text>
              {isAutoTranslation && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>自動翻訳の下書き</Text>
                </View>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.multiline, styles.detailInput]}
              value={value.exampleTranslation}
              onChangeText={(text) => set("exampleTranslation", text)}
              editable={editable}
              multiline
              maxLength={LIMITS.example}
            />
            {translationStatus?.state === "loading" && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Text style={styles.hint}>訳を作っています…</Text>
              </View>
            )}
            {translationStatus?.state === "failed" && !!translationStatus.message && <Text style={styles.failure}>{translationStatus.message}</Text>}
            {isAutoTranslation && translationStatus?.state !== "loading" && <Text style={styles.hint}>内容を確認して、必要なら直してください。</Text>}
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  failure: { fontSize: 13, color: colors.warningText },
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
  chipReview: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipTextReview: { fontWeight: "bold", color: colors.surface },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 4 },
  detailsToggleText: { fontSize: 16, fontWeight: "bold", color: colors.secondary },
});
