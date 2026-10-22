import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { cleanCapturedText, looksJapanese, looksLikeSentence } from "@/db/capture";
import { draftMeaning, type TranslateFn } from "@/db/draft";
import { ValidationError } from "@/db/repository";
import type { DeckSummary } from "@/db/types";
import { CardForm, emptyCardForm, type CardFormValue } from "@/components/CardForm";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";
import { returnToPreviousApp } from "../../modules/selected-text";

/**
 * 翻訳の部品を、アプリ共通の形に合わせる
 * 翻訳の部品（ネイティブ）は、含まれていない版のアプリでは、読み込んだ時点でエラーになる
 * 起動時にアプリ全体が落ちないよう、使うときに初めて読み込む（失敗は呼び出し側が理由つきで受け取る）
 */
const translate: TranslateFn = async (params) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { onTranslateTask } = require("expo-translate-text") as typeof import("expo-translate-text");
  return onTranslateTask({ ...params, requiresWifi: false });
};

/**
 * 他のアプリで選んだ文字を、単語として登録する画面
 * 意味は、端末内の翻訳で下書きを入れる。あなたが直して「登録」すると保存され、元のアプリに戻る
 */
export default function CaptureScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { text } = useLocalSearchParams<{ text?: string }>();

  const initialTerm = cleanCapturedText(text ?? "");
  const [value, setValue] = useState<CardFormValue>({ ...emptyCardForm(), term: initialTerm });
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<"loading" | "done" | "none">(initialTerm ? "loading" : "none");
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const meaningTouched = useRef(false);
  const duplicateWarning = useDuplicateWarning(repository, deckId ?? undefined, value.term);

  // 登録先の単語帳（自分の単語帳の先頭を既定にする）
  useEffect(() => {
    let active = true;
    repository.listDecks().then((list) => {
      if (!active) return;
      setDecks(list);
      setDeckId((current) => current ?? list[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  // 意味の下書きを作る。あなたが意味を入力し始めていたら、上書きしない
  useEffect(() => {
    if (!initialTerm) return;
    let active = true;
    draftMeaning(initialTerm, translate).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        if (!meaningTouched.current) setValue((prev) => ({ ...prev, meaning: result.meaning }));
        setDraftNote("意味は自動で入れた下書きです。内容を確認して、必要なら直してください");
        setDraftState("done");
      } else {
        setDraftNote(result.reason);
        setDraftState("none");
      }
    });
    return () => {
      active = false;
    };
  }, [initialTerm]);

  const onChange = (next: CardFormValue) => {
    if (next.meaning !== value.meaning) meaningTouched.current = true;
    setValue(next);
  };

  /** 保存したあと、選択元のアプリに戻る。戻れない場合（アプリ内から開いたとき）は、単語帳へ */
  const finish = () => {
    returnToPreviousApp();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const save = async () => {
    if (isSaving || !deckId) return;
    setIsSaving(true);
    try {
      await repository.addCard(deckId, value);
      finish();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "保存できませんでした");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>単語を登録</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, (isSaving || !deckId) && styles.disabled]} disabled={isSaving || !deckId} onPress={save}>
          <Text style={styles.buttonText}>登録</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={finish}>
          <Text style={styles.lightText}>やめる</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {looksJapanese(initialTerm) && <Text style={styles.note}>日本語の文字を含んでいます。英語の単語を選んだ場合は、選び直してください。</Text>}
        {looksLikeSentence(initialTerm) && <Text style={styles.note}>文のように長いです。単語や熟語だけにするか、例文の欄に移してください。</Text>}

        {decks.length > 1 && (
          <>
            <Text style={styles.label}>登録先の単語帳</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {decks.map((deck) => (
                <TouchableOpacity key={deck.id} style={[styles.chip, deckId === deck.id && styles.chipSelected]} onPress={() => setDeckId(deck.id)}>
                  <Text style={[styles.chipText, deckId === deck.id && styles.chipTextSelected]}>{deck.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
        {decks.length === 1 && <Text style={styles.label}>登録先: {decks[0].name}</Text>}

        {draftState === "loading" && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#446158" />
            <Text style={styles.loadingText}>意味を調べています…（初回は、翻訳のデータを取得するため、時間がかかります）</Text>
          </View>
        )}
        {!!draftNote && draftState !== "loading" && <Text style={styles.note}>{draftNote}</Text>}

        <CardForm value={value} onChange={onChange} editable duplicateWarning={duplicateWarning} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  button: { flex: 1, backgroundColor: "#9fd700", padding: 14, borderRadius: 10, alignItems: "center" },
  secondary: { backgroundColor: "#446158" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#446158", fontSize: 17, fontWeight: "bold" },
  lightText: { color: "white", fontSize: 17, fontWeight: "bold" },
  error: { color: "#ff5757", fontSize: 16, marginTop: 8, paddingHorizontal: 16 },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: "600", color: "#446158", marginTop: 12, marginBottom: 4 },
  note: { fontSize: 14, color: "#b26a00", marginTop: 10 },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderColor: "gray", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: "#9fd700", borderColor: "#9fd700" },
  chipText: { fontSize: 15, color: "black" },
  chipTextSelected: { color: "white", fontWeight: "bold" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  loadingText: { flex: 1, fontSize: 14, color: "#446158" },
});
