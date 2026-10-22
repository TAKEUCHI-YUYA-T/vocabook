import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import type { Deck } from "@/db/types";
import { CardForm, emptyCardForm, type CardFormValue } from "@/components/CardForm";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";

/**
 * 単語の追加画面
 * 「保存して次へ」で、品詞を引き継いだまま続けて入力できる
 */
export default function NewCardScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [value, setValue] = useState<CardFormValue>(emptyCardForm());
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const duplicateWarning = useDuplicateWarning(repository, deckId, value.term);

  useEffect(() => {
    repository.getDeck(deckId).then(setDeck).catch(() => setError("単語帳を読み込めませんでした"));
  }, [repository, deckId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/decks/[id]", params: { id: deckId } });
  };

  const save = async (continueAdding: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const card = await repository.addCard(deckId, value);
      setError(null);
      if (continueAdding) {
        setNotice(`「${card.term}」を追加しました`);
        setValue(emptyCardForm(value.partOfSpeech));
        // フォームを作り直して、単語の欄にカーソルを戻す
        setFormKey((n) => n + 1);
      } else {
        goBack();
      }
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "保存できませんでした");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>単語を追加{deck ? `（${deck.name}）` : ""}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, isSaving && styles.disabled]} disabled={isSaving} onPress={() => save(true)}>
          <Text style={styles.buttonText}>保存して次へ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondary, isSaving && styles.disabled]} disabled={isSaving} onPress={() => save(false)}>
          <Text style={styles.lightText}>保存して戻る</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && !error && <Text style={styles.notice}>{notice}</Text>}

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <CardForm key={formKey} value={value} onChange={setValue} editable autoFocus duplicateWarning={duplicateWarning} />
        <TouchableOpacity style={styles.cancel} onPress={goBack}>
          <Text style={styles.cancelText}>やめる</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  button: { flex: 1, backgroundColor: "#9fd700", padding: 14, borderRadius: 10, alignItems: "center" },
  secondary: { backgroundColor: "#446158" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#446158", fontSize: 17, fontWeight: "bold" },
  lightText: { color: "white", fontSize: 17, fontWeight: "bold" },
  error: { color: "#ff5757", fontSize: 16, marginTop: 8, paddingHorizontal: 16 },
  notice: { color: "#446158", fontSize: 16, marginTop: 8, paddingHorizontal: 16 },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  cancel: { marginTop: 24, alignItems: "center", padding: 12 },
  cancelText: { color: "#ff5757", fontSize: 17, fontWeight: "bold" },
});
