import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectButton } from "@/components/SelectButton";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { buildPreview, detectColumns, IMPORT_FIELDS, IMPORT_LIMITS, parseTable, type ColumnMapping, type ImportField } from "@/db/importing";
import { ValidationError } from "@/db/repository";
import { partOfSpeechLabel } from "@/db/types";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useGoBack } from "@/hooks/useGoBack";

type Step = "input" | "preview" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "input", label: "入力" },
  { key: "preview", label: "確認" },
  { key: "done", label: "完了" },
];

/** 画面に出すエラー行の最大数（多すぎると読めないため） */
const MAX_ERRORS_SHOWN = 20;

/** 「なし」を表す選択肢のキー（任意の項目に対応する列を選ばない） */
const NO_COLUMN = "none";

/** 手順の表示（入力 → 確認 → 完了）。終わった手順にはチェック、いまの手順は黄緑 */
function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  return (
    <View style={styles.stepper} accessibilityRole="progressbar" accessibilityLabel={`手順 ${currentIndex + 1} / ${STEPS.length}`}>
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex || (current === "done" && index === currentIndex);
        const isCurrent = index === currentIndex && current !== "done";
        return (
          <React.Fragment key={step.key}>
            {index > 0 && <View style={[styles.stepLine, index <= currentIndex && styles.stepLineDone]} />}
            <View style={styles.step}>
              <View style={[styles.stepCircle, isDone && styles.stepCircleDone, isCurrent && styles.stepCircleCurrent, !isDone && !isCurrent && styles.stepCircleFuture]}>
                {isDone ? <Feather name="check" size={14} color={colors.onSecondary} /> : <Text style={[styles.stepNumber, isCurrent && styles.stepNumberCurrent]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>{step.label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/**
 * 取り込み画面（貼り付け・CSV ファイル）
 * 入力 → 確認（列の対応を確認、件数とエラーを表示）→ 完了 の順に進む
 */
export default function ImportScreen() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/words");
  const { deck, error: deckError } = useDefaultDeck();

  const [step, setStep] = useState<Step>("input");
  const [pasted, setPasted] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [hasHeader, setHasHeader] = useState(true);
  const [existing, setExisting] = useState<{ term: string; meaning: string }[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  // 重複の判定に使う既存の単語を読み込む（単語帳が決まったとき）
  useEffect(() => {
    if (!deck) return;
    let active = true;
    repository
      .listCards(deck.id)
      .then((cards) => active && setExisting(cards.map((c) => ({ term: c.term, meaning: c.meaning }))))
      .catch(() => active && setError("単語帳を読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository, deck]);

  /** 入力されたテキストを表にして、確認へ進む */
  const startPreview = (text: string) => {
    try {
      const parsed = parseTable(text);
      if (parsed.rows.length === 0) {
        setError("取り込める行がありません");
        return;
      }
      const detected = detectColumns(parsed.rows);
      setTable(parsed.rows);
      setMapping(detected.mapping);
      setHasHeader(detected.hasHeader);
      setTruncated(parsed.truncated);
      setError(null);
      setStep("preview");
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "読み取れませんでした");
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        setError("クリップボードに文字がありません。スプレッドシートの範囲をコピーしてから押してください");
        return;
      }
      setPasted(text);
      setError(null);
    } catch {
      setError("クリップボードを読み取れませんでした");
    }
  };

  const pickFile = async () => {
    try {
      setIsBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/tab-separated-values", "text/plain", "application/csv", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size != null && asset.size > IMPORT_LIMITS.maxBytes) {
        setError("ファイルが大きすぎます（5MB まで）。ファイルを分けて取り込んでください");
        return;
      }
      const text = await new File(asset.uri).text();
      setFileName(asset.name);
      startPreview(text);
    } catch {
      setError("ファイルを読み取れませんでした。CSV 形式（UTF-8）のファイルを選んでください");
    } finally {
      setIsBusy(false);
    }
  };

  const preview = useMemo(() => buildPreview(table, mapping, hasHeader, existing), [table, mapping, hasHeader, existing]);
  const header = table[0] ?? [];
  const canImport = !!deck && preview.valid.length > 0 && !isBusy;

  const confirmImport = async () => {
    if (!canImport || !deck) return;
    setIsBusy(true);
    try {
      const count = await repository.importCards(
        deck.id,
        preview.valid.map((row) => row.input)
      );
      setImportedCount(count);
      setError(null);
      setStep("done");
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "取り込めませんでした。もう一度試してください");
    } finally {
      setIsBusy(false);
    }
  };

  /** 列の対応を、見出しの名前の一覧から選び直す */
  const setColumn = (field: ImportField, index: number | null) => {
    setMapping((prev) => {
      const next = { ...prev };
      // 同じ列を、ほかの項目が使っていたら外す（1つの列は1つの項目だけに使う）
      for (const key of Object.keys(next) as ImportField[]) if (index !== null && next[key] === index) delete next[key];
      if (index === null) delete next[field];
      else next[field] = index;
      return next;
    });
  };

  const columnLabel = (index: number) => (hasHeader && header[index]?.trim() ? header[index].trim().slice(0, 12) : `列${index + 1}`);

  const message = error ?? deckError;
  const bottomPadding = Math.max(insets.bottom, 12) + 16;

  if (step === "done") {
    return (
      <View style={styles.container}>
        <ScreenHeader title="取り込み" />
        <Stepper current="done" />
        <View style={styles.doneBody}>
          <View style={styles.doneIcon}>
            <Feather name="check" size={36} color={colors.onPrimary} />
          </View>
          <Text style={styles.doneTitle}>{importedCount}語を取り込みました</Text>
        </View>
        <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => router.replace("/words")}>
            <Text style={styles.primaryButtonText}>単語帳を見る</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="取り込み"
        onBack={step === "preview" ? () => { setStep("input"); setError(null); } : goBack}
        backLabel={step === "preview" ? "入力に戻る" : "単語帳に戻る"}
      />
      <Stepper current={step} />

      {step === "input" ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]} keyboardShouldPersistTaps="handled">
          {!!message && <Text style={styles.error}>{message}</Text>}

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Feather name="clipboard" size={22} color={colors.secondary} />
              <Text style={styles.sectionTitle}>表を貼り付ける</Text>
            </View>
            <Text style={styles.sectionHelp}>スプレッドシートや Excel で、表の範囲をコピーしてから押してください。</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={pasteFromClipboard}>
              <Text style={styles.secondaryButtonText}>クリップボードから貼り付け</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.pasteBox}
              value={pasted}
              onChangeText={setPasted}
              multiline
              accessibilityLabel="貼り付けた内容"
              placeholder="ここに貼り付けることもできます（タブ・カンマ区切り）"
              textAlignVertical="top"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !pasted.trim() }}
              style={[styles.primaryButton, !pasted.trim() && styles.disabled]}
              disabled={!pasted.trim()}
              onPress={() => {
                setFileName(null);
                startPreview(pasted);
              }}
            >
              <Text style={styles.primaryButtonText}>内容を確認</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Feather name="file-text" size={22} color={colors.secondary} />
              <Text style={styles.sectionTitle}>CSV ファイルを選ぶ</Text>
            </View>
            <Text style={styles.sectionHelp}>スプレッドシートを「CSV でダウンロード」したファイルや、このアプリで書き出したファイル</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.outlineButton} onPress={pickFile} disabled={isBusy}>
              {isBusy ? <ActivityIndicator color={colors.secondary} /> : <Text style={styles.outlineButtonText}>ファイルを選ぶ</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.infoPanel}>1行目に「単語」「意味」「品詞」「例文」「例文の訳」「メモ」の見出しがあると、列を自動で判定します。列の並びは自由です。</Text>
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {!!message && <Text style={styles.error}>{message}</Text>}
            {!!fileName && <Text style={styles.fileName}>ファイル: {fileName}</Text>}

            <View style={styles.stats}>
              <View style={[styles.stat, styles.statMain]}>
                <Text style={[styles.statLabel, styles.statLabelMain]}>取り込める</Text>
                <Text style={styles.statValue}>{preview.valid.length}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>エラー</Text>
                <Text style={styles.statValue}>{preview.errors.length}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>重複で除く</Text>
                <Text style={styles.statValue}>{preview.skippedDuplicates}</Text>
              </View>
            </View>
            {preview.sameTermDifferentMeaning > 0 && (
              <Text style={styles.statNote}>{preview.sameTermDifferentMeaning}件は、同じ単語がすでにありますが、意味が違うため取り込みます</Text>
            )}
            {truncated && <Text style={styles.statNoteError}>行数が多いため、先頭の{IMPORT_LIMITS.maxRows}行だけを対象にしています</Text>}

            <View style={styles.mappingHeader}>
              <Text style={styles.blockTitle}>列の対応</Text>
              <View style={styles.headerSwitch}>
                <Text style={styles.headerSwitchLabel}>1行目は見出し</Text>
                <Switch
                  value={hasHeader}
                  onValueChange={setHasHeader}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="1行目は見出し"
                />
              </View>
            </View>
            <View style={styles.mappingBox}>
              {IMPORT_FIELDS.map((field, index) => {
                const column = mapping[field.key];
                return (
                  <View key={field.key} style={[styles.mappingRow, index > 0 && styles.mappingRowBorder]}>
                    <Text style={[styles.mappingLabel, field.required && styles.mappingLabelRequired]}>
                      {field.label}
                      {field.required && <Text style={styles.mappingRequired}>（必須）</Text>}
                    </Text>
                    <SelectButton
                      title={`${field.label}にする列`}
                      value={column === undefined ? (field.required ? null : "なし") : columnLabel(column)}
                      options={[
                        ...(field.required ? [] : [{ key: NO_COLUMN, label: "なし" }]),
                        ...header.map((_, i) => ({ key: String(i), label: columnLabel(i) })),
                      ]}
                      selectedKey={column === undefined ? (field.required ? null : NO_COLUMN) : String(column)}
                      onSelect={(key) => setColumn(field.key, key === NO_COLUMN ? null : Number(key))}
                    />
                  </View>
                );
              })}
            </View>

            {preview.valid.length > 0 && (
              <>
                <Text style={styles.blockTitle}>先頭の3件</Text>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    <Text style={[styles.cell, styles.cellTerm, styles.cellHead]}>単語</Text>
                    <Text style={[styles.cell, styles.cellMeaning, styles.cellHead]}>意味</Text>
                    <Text style={[styles.cell, styles.cellPos, styles.cellHead]}>品詞</Text>
                  </View>
                  {preview.valid.slice(0, 3).map((row) => (
                    <View key={row.rowNumber} style={[styles.tableRow, styles.tableRowBorder]}>
                      <Text style={[styles.cell, styles.cellTerm, styles.cellBold]} numberOfLines={1}>
                        {row.input.term}
                      </Text>
                      <Text style={[styles.cell, styles.cellMeaning]} numberOfLines={1}>
                        {row.input.meaning || "（意味なし）"}
                      </Text>
                      <Text style={[styles.cell, styles.cellPos]} numberOfLines={1}>
                        {partOfSpeechLabel(row.input.partOfSpeech)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {preview.errors.length > 0 && (
              <>
                <Text style={styles.blockTitle}>エラーの行</Text>
                {preview.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                  <Text key={e.rowNumber} style={styles.errorRow}>
                    {e.rowNumber}行目: {e.message}
                  </Text>
                ))}
                {preview.errors.length > MAX_ERRORS_SHOWN && <Text style={styles.errorRow}>ほか{preview.errors.length - MAX_ERRORS_SHOWN}件</Text>}
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !canImport }}
              style={[styles.primaryButton, styles.footerButton, !canImport && styles.disabled]}
              disabled={!canImport}
              onPress={confirmImport}
            >
              {isBusy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryButtonText, styles.footerButtonText]}>{preview.valid.length}件を取り込む</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 14, gap: 14 },
  error: { color: colors.danger, fontSize: 15 },
  disabled: { opacity: 0.4 },

  stepper: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.secondary },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepCircleDone: { backgroundColor: colors.secondary },
  stepCircleCurrent: { backgroundColor: colors.primary },
  stepCircleFuture: { borderWidth: 2, borderColor: colors.secondary },
  stepNumber: { fontSize: 13, color: colors.secondary },
  stepNumberCurrent: { color: colors.onPrimary },
  stepLabel: { fontSize: 14, color: colors.secondary },
  stepLabelCurrent: { fontWeight: "bold", color: colors.text },

  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: colors.text },
  sectionHelp: { fontSize: 14, lineHeight: 22, color: colors.secondary },
  pasteBox: { minHeight: 90, maxHeight: 200, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, backgroundColor: colors.surface, color: colors.text },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 17, fontWeight: "bold", color: colors.onPrimary },
  secondaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontWeight: "bold", color: colors.onSecondary },
  outlineButton: { minHeight: 50, borderWidth: 2, borderColor: colors.secondary, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  outlineButtonText: { fontSize: 16, fontWeight: "bold", color: colors.secondary },
  infoPanel: { fontSize: 14, lineHeight: 24, color: colors.text, backgroundColor: colors.panel, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },

  fileName: { fontSize: 14, color: colors.secondary },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  statMain: { backgroundColor: colors.primary, borderColor: colors.primary },
  statLabel: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  statLabelMain: { color: colors.onPrimary },
  statValue: { fontSize: 28, fontWeight: "bold", lineHeight: 34, color: colors.text },
  statNote: { fontSize: 14, color: colors.secondary },
  statNoteError: { fontSize: 14, color: colors.danger },

  blockTitle: { fontSize: 15, fontWeight: "bold", color: colors.secondary },
  mappingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSwitch: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerSwitchLabel: { fontSize: 14, color: colors.text },
  mappingBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  mappingRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, paddingHorizontal: 12 },
  mappingRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  mappingLabel: { flex: 1, fontSize: 15, color: colors.text },
  mappingLabelRequired: { fontWeight: "bold" },
  mappingRequired: { fontSize: 12, fontWeight: "500", color: colors.secondary },

  table: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableHead: { backgroundColor: colors.panel },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  cell: { fontSize: 13, color: colors.text, paddingVertical: 6, paddingHorizontal: 10 },
  cellHead: { fontWeight: "bold" },
  cellBold: { fontWeight: "bold" },
  cellTerm: { flex: 3 },
  cellMeaning: { flex: 4 },
  cellPos: { flex: 2 },
  errorRow: { fontSize: 14, color: colors.danger },

  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.background },
  footerButton: { minHeight: 56 },
  footerButtonText: { fontSize: 18 },

  doneBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 20, fontWeight: "bold", color: colors.text, textAlign: "center" },
});
