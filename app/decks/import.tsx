import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRepository } from "@/db/AppDatabase";
import { buildPreview, detectColumns, IMPORT_FIELDS, IMPORT_LIMITS, parseTable, type ColumnMapping, type ImportField } from "@/db/importing";
import { ValidationError } from "@/db/repository";
import type { Deck } from "@/db/types";

type Step = "input" | "preview" | "done";

/** 画面に出すエラー行の最大数（多すぎると読めないため） */
const MAX_ERRORS_SHOWN = 20;

/**
 * 取り込み画面（貼り付け・CSV ファイル）
 * 入力 → プレビュー（列の対応を確認、件数とエラーを表示）→ 取り込み の順に進む
 */
export default function ImportScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [step, setStep] = useState<Step>("input");
  const [deck, setDeck] = useState<Deck | null>(null);
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

  // 取り込み先の単語帳と、重複の判定に使う既存の単語を読み込む（初回だけ）
  React.useEffect(() => {
    let active = true;
    Promise.all([repository.getDeck(deckId), repository.listCards(deckId)])
      .then(([foundDeck, cards]) => {
        if (!active) return;
        setDeck(foundDeck);
        setExisting(cards.map((c) => ({ term: c.term, meaning: c.meaning })));
      })
      .catch(() => active && setError("単語帳を読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository, deckId]);

  /** 入力されたテキストを表にして、プレビューへ進む */
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
  const canImport = preview.valid.length > 0 && !isBusy;

  const confirmImport = async () => {
    if (!canImport) return;
    setIsBusy(true);
    try {
      const count = await repository.importCards(
        deckId,
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

  const goToDeck = () => router.replace({ pathname: "/decks/[id]", params: { id: deckId } });

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

  if (step === "done") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{importedCount}語を取り込みました</Text>
        <TouchableOpacity style={styles.button} onPress={goToDeck}>
          <Text style={styles.buttonText}>単語帳に戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>取り込み{deck ? `（${deck.name}）` : ""}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {step === "input" ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.help}>
            スプレッドシートや Excel の表をコピーして貼り付けるか、CSV ファイルを選んでください。1行目に「単語」「意味」などの見出しがあると、自動で列を判定します。
          </Text>

          <TouchableOpacity style={styles.button} onPress={pasteFromClipboard}>
            <Text style={styles.buttonText}>クリップボードから貼り付け</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.pasteBox}
            value={pasted}
            onChangeText={setPasted}
            multiline
            placeholder="ここに表を貼り付けます（タブ・カンマ区切り）"
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !pasted.trim() && styles.disabled]}
            disabled={!pasted.trim()}
            onPress={() => {
              setFileName(null);
              startPreview(pasted);
            }}
          >
            <Text style={styles.buttonText}>貼り付けた内容を確認</Text>
          </TouchableOpacity>

          <Text style={styles.or}>または</Text>
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={pickFile} disabled={isBusy}>
            {isBusy ? <ActivityIndicator color="white" /> : <Text style={styles.lightText}>CSV ファイルを選ぶ</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!!fileName && <Text style={styles.help}>ファイル: {fileName}</Text>}

          <View style={styles.summary}>
            <Text style={styles.summaryMain}>{preview.valid.length}件を取り込めます</Text>
            {preview.errors.length > 0 && <Text style={styles.summaryError}>{preview.errors.length}件はエラーのため取り込めません</Text>}
            {preview.skippedDuplicates > 0 && <Text style={styles.summarySub}>{preview.skippedDuplicates}件は、すでにある（または重複する）ため取り込みません</Text>}
            {preview.sameTermDifferentMeaning > 0 && (
              <Text style={styles.summarySub}>{preview.sameTermDifferentMeaning}件は、同じ単語がすでにありますが、意味が違うため取り込みます</Text>
            )}
            {truncated && <Text style={styles.summaryError}>行数が多いため、先頭の{IMPORT_LIMITS.maxRows}行だけを対象にしています</Text>}
          </View>

          <Text style={styles.sectionTitle}>列の対応（違っていたら選び直してください）</Text>
          <TouchableOpacity style={styles.toggle} onPress={() => setHasHeader((v) => !v)}>
            <Text style={styles.toggleText}>{hasHeader ? "☑" : "☐"} 1行目は見出し行</Text>
          </TouchableOpacity>
          {IMPORT_FIELDS.map((field) => (
            <View key={field.key} style={styles.mappingRow}>
              <Text style={styles.mappingLabel}>
                {field.label}
                {field.required ? "（必須）" : ""}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {!field.required && (
                  <TouchableOpacity style={[styles.chip, mapping[field.key] === undefined && styles.chipSelected]} onPress={() => setColumn(field.key, null)}>
                    <Text style={[styles.chipText, mapping[field.key] === undefined && styles.chipTextSelected]}>なし</Text>
                  </TouchableOpacity>
                )}
                {header.map((name, index) => (
                  <TouchableOpacity key={index} style={[styles.chip, mapping[field.key] === index && styles.chipSelected]} onPress={() => setColumn(field.key, index)}>
                    <Text style={[styles.chipText, mapping[field.key] === index && styles.chipTextSelected]}>
                      {hasHeader && name.trim() ? name.trim().slice(0, 12) : `列${index + 1}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          {preview.valid.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>先頭の3件</Text>
              {preview.valid.slice(0, 3).map((row) => (
                <View key={row.rowNumber} style={styles.sample}>
                  <Text style={styles.sampleTerm}>{row.input.term}</Text>
                  <Text style={styles.sampleMeaning}>{row.input.meaning || "（意味なし）"}</Text>
                </View>
              ))}
            </>
          )}

          {preview.errors.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>エラーの行</Text>
              {preview.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                <Text key={e.rowNumber} style={styles.errorRow}>
                  {e.rowNumber}行目: {e.message}
                </Text>
              ))}
              {preview.errors.length > MAX_ERRORS_SHOWN && <Text style={styles.errorRow}>ほか{preview.errors.length - MAX_ERRORS_SHOWN}件</Text>}
            </>
          )}

          <TouchableOpacity style={[styles.button, !canImport && styles.disabled]} disabled={!canImport} onPress={confirmImport}>
            {isBusy ? <ActivityIndicator color="#446158" /> : <Text style={styles.buttonText}>{preview.valid.length}件を取り込む</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondary]}
            onPress={() => {
              setStep("input");
              setError(null);
            }}
          >
            <Text style={styles.lightText}>入力し直す</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.back} onPress={goToDeck}>
        <Text style={styles.backText}>やめて単語帳に戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#fffeef", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  help: { fontSize: 15, color: "#446158", marginBottom: 12 },
  error: { color: "#ff5757", fontSize: 16, paddingHorizontal: 16, marginBottom: 8 },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, marginVertical: 6, alignItems: "center" },
  secondary: { backgroundColor: "#446158" },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
  lightText: { color: "white", fontSize: 18, fontWeight: "bold" },
  pasteBox: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 10, fontSize: 15, minHeight: 120, maxHeight: 220, backgroundColor: "white", marginVertical: 6 },
  or: { textAlign: "center", color: "#446158", marginVertical: 8 },
  summary: { backgroundColor: "#f3f0d8", borderRadius: 10, padding: 12, marginBottom: 8 },
  summaryMain: { fontSize: 18, fontWeight: "bold", color: "black" },
  summaryError: { fontSize: 15, color: "#ff5757", marginTop: 4 },
  summarySub: { fontSize: 14, color: "#446158", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#446158", marginTop: 14, marginBottom: 6 },
  toggle: { paddingVertical: 6 },
  toggleText: { fontSize: 16, color: "black" },
  mappingRow: { marginBottom: 6 },
  mappingLabel: { fontSize: 14, color: "#446158", marginBottom: 4 },
  chips: { gap: 6, paddingBottom: 2 },
  chip: { borderWidth: 1, borderColor: "gray", borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11 },
  chipSelected: { backgroundColor: "#9fd700", borderColor: "#9fd700" },
  chipText: { fontSize: 14, color: "black" },
  chipTextSelected: { color: "white", fontWeight: "bold" },
  sample: { borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 6 },
  sampleTerm: { fontSize: 16, fontWeight: "bold", color: "black" },
  sampleMeaning: { fontSize: 14, color: "#333" },
  errorRow: { fontSize: 14, color: "#ff5757", marginBottom: 2 },
  back: { alignItems: "center", padding: 14 },
  backText: { color: "#ff5757", fontSize: 16, fontWeight: "bold" },
});
