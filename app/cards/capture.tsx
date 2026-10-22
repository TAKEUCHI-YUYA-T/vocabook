import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { extractSelection, looksJapanese, looksLikeSentence } from "@/db/capture";
import { draftMeaning } from "@/db/draft";
import { translateOnDevice } from "@/db/translate";
import { ValidationError } from "@/db/repository";
import { CardForm, emptyCardForm, type CardFormValue } from "@/components/CardForm";
import { useCardAutoFill } from "@/hooks/useCardAutoFill";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";
import { returnToPreviousApp } from "../../modules/selected-text";

/**
 * 他のアプリで選んだ文字を、単語として登録する画面
 * 意味は、端末内の翻訳で下書きを入れる。あなたが直して「登録して戻る」を押すと保存され、元のアプリに戻る
 */
export default function CaptureScreen() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const { text } = useLocalSearchParams<{ text?: string }>();
  const { deck, error: deckError } = useDefaultDeck();

  // 共有された文字から、単語を取り出す（Chrome は、選んだ文字ではなく URL を送ることがある）
  const selection = useMemo(() => extractSelection(text ?? ""), [text]);
  const initialTerm = selection.term;
  const [value, setValue] = useState<CardFormValue>({ ...emptyCardForm(), term: initialTerm });
  const [draftState, setDraftState] = useState<"loading" | "done" | "none">(initialTerm ? "loading" : "none");
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [draftDetail, setDraftDetail] = useState<string | null>(null);
  const [meaningEdited, setMeaningEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const duplicateWarning = useDuplicateWarning(repository, deck?.id, value.term);
  // 選んだ単語の品詞も、最初から推定する（例文を入れたときの訳も自動で入る）
  const autoFill = useCardAutoFill(value, setValue, { guessInitialTerm: true });

  // 意味の下書きを作る。あなたが意味を入力し始めていたら、上書きしない
  useEffect(() => {
    if (!initialTerm) return;
    let active = true;
    draftMeaning(initialTerm, translateOnDevice).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setValue((prev) => (prev.meaning ? prev : { ...prev, meaning: result.meaning }));
        setDraftState("done");
      } else {
        setDraftNote(result.reason);
        // 原因の特定用に、元のエラーの本文を、画面とログに残す
        if (result.status === "failed") {
          setDraftDetail(result.detail);
          console.warn("[capture] 翻訳に失敗:", result.detail);
        }
        setDraftState("none");
      }
    });
    return () => {
      active = false;
    };
  }, [initialTerm]);

  const onChange = (next: CardFormValue) => {
    if (next.meaning !== value.meaning) setMeaningEdited(true);
    setValue(next);
  };

  /** 保存したあと、選択元のアプリに戻る。戻れない場合（アプリ内から開いたとき）は、ホームへ */
  const finish = () => {
    returnToPreviousApp();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const save = async () => {
    if (isSaving || !deck) return;
    setIsSaving(true);
    try {
      await repository.addCard(deck.id, value);
      finish();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "保存できませんでした");
    } finally {
      setIsSaving(false);
    }
  };

  const isDraftShown = draftState === "done" && !meaningEdited;
  const notes = [
    selection.kind === "fragment" && "共有された URL から、選んだ単語を取り出しました。",
    selection.kind === "url-only" &&
      "URL だけが共有され、単語を取り出せませんでした。単語を選び直して、選択メニューの「vocabook」から送ると、確実に単語だけが届きます。",
    looksJapanese(initialTerm) && "日本語の文字を含んでいます。英語の単語を選んだ場合は、選び直してください。",
    looksLikeSentence(initialTerm) && "文のように長いです。単語や熟語だけにするか、例文の欄に移してください。",
    draftState !== "loading" && draftState !== "done" && draftNote,
  ].filter((note): note is string => !!note);

  return (
    <View style={styles.container}>
      <ScreenHeader title="単語を登録" onBack={finish} backIcon="close" backLabel="やめる" bordered />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notes.map((note) => (
          <Text key={note} style={styles.note}>
            {note}
          </Text>
        ))}
        {!!draftDetail && draftState !== "loading" && <Text style={styles.detail}>詳細: {draftDetail}</Text>}

        {draftState === "loading" && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.secondary} />
            <Text style={styles.loadingText}>意味を調べています…（初回は、翻訳のデータを取得するため、時間がかかります）</Text>
          </View>
        )}

        <CardForm
          value={value}
          onChange={onChange}
          editable
          duplicateWarning={duplicateWarning}
          autoFill={autoFill}
          meaningBadge={isDraftShown ? "自動翻訳の下書き" : null}
          meaningHint={isDraftShown ? "内容を確認して、必要なら直してください。" : null}
        />

        {!!(error ?? deckError) && <Text style={styles.error}>{error ?? deckError}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={finish}>
          <Text style={styles.cancelText}>やめる</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving || !deck }}
          style={[styles.saveButton, (isSaving || !deck) && styles.disabled]}
          disabled={isSaving || !deck}
          onPress={save}
        >
          <Text style={styles.saveText}>登録して戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  note: { fontSize: 14, lineHeight: 22, color: colors.warningText, backgroundColor: colors.panel, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  detail: { fontSize: 12, color: "#777" },
  error: { color: colors.danger, fontSize: 15 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { flex: 1, fontSize: 14, color: colors.secondary },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  cancelButton: { flex: 1, minHeight: 54, borderWidth: 2, borderColor: colors.secondary, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 17, fontWeight: "bold", color: colors.secondary },
  saveButton: { flex: 2, minHeight: 54, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 18, fontWeight: "bold", color: colors.onPrimary },
  disabled: { opacity: 0.5 },
});
