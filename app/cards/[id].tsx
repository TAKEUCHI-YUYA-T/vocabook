import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import type { Card, Deck } from "@/db/types";
import { CardForm, type CardFormValue } from "@/components/CardForm";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";

const toFormValue = (card: Card): CardFormValue => ({
  term: card.term,
  meaning: card.meaning,
  partOfSpeech: card.partOfSpeech,
  example: card.example,
  exampleTranslation: card.exampleTranslation,
  note: card.note,
});

/**
 * 単語の編集画面
 * - 自分の単語帳の単語: 編集・削除できる
 * - 標準の単語帳の単語: 見るだけ（編集するには単語帳をコピーする）
 */
export default function EditCardScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [card, setCard] = useState<Card | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [value, setValue] = useState<CardFormValue | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const duplicateWarning = useDuplicateWarning(repository, card?.deckId, value?.term ?? "", card?.id);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await repository.getCard(id);
      const foundDeck = found ? await repository.getDeck(found.deckId) : null;
      if (!active) return;
      setCard(found);
      setDeck(foundDeck);
      setValue(found ? toFormValue(found) : null);
      setIsLoaded(true);
    })().catch(() => active && setError("読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository, id]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/decks");
  };

  const run = async (action: () => Promise<void>) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "保存できませんでした");
    } finally {
      setIsSaving(false);
    }
  };

  if (!card || !value) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{error ?? (isLoaded ? "この単語は見つかりませんでした（削除された可能性があります）" : "読み込み中...")}</Text>
        <TouchableOpacity style={styles.cancel} onPress={goBack}>
          <Text style={styles.cancelText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const editable = deck?.kind === "user";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{editable ? "単語を編集" : "単語の詳細"}</Text>
      {deck && <Text style={styles.subtitle}>{deck.name}</Text>}

      {editable ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, isSaving && styles.disabled]}
            disabled={isSaving}
            onPress={() =>
              run(async () => {
                await repository.updateCard(card.id, value);
                goBack();
              })
            }
          >
            <Text style={styles.buttonText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.dangerOutline]} onPress={() => setIsConfirmingDelete(true)}>
            <Text style={styles.dangerText}>削除</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.readonlyNote}>標準の単語帳の単語は編集できません。編集したい場合は、単語帳の画面で「コピーして編集する」を使ってください。</Text>
      )}

      {isConfirmingDelete && (
        <View style={styles.panel}>
          <Text style={styles.panelText}>「{card.term}」を削除します。よろしいですか？</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.danger]}
              onPress={() =>
                run(async () => {
                  await repository.deleteCard(card.id);
                  goBack();
                })
              }
            >
              <Text style={styles.lightText}>削除する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => setIsConfirmingDelete(false)}>
              <Text style={styles.lightText}>やめる</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <CardForm value={value} onChange={setValue} editable={editable} duplicateWarning={editable ? duplicateWarning : null} />
        <TouchableOpacity style={styles.cancel} onPress={goBack}>
          <Text style={styles.cancelText}>{editable ? "保存せずに戻る" : "戻る"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", paddingHorizontal: 16 },
  subtitle: { fontSize: 14, color: "#446158", textAlign: "center", marginBottom: 8 },
  message: { fontSize: 16, color: "#446158", textAlign: "center", marginTop: 40, paddingHorizontal: 16 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  button: { flex: 1, backgroundColor: "#9fd700", padding: 14, borderRadius: 10, alignItems: "center" },
  secondary: { backgroundColor: "#446158" },
  danger: { backgroundColor: "#ff5757" },
  dangerOutline: { borderWidth: 2, borderColor: "#ff5757", backgroundColor: "transparent" },
  dangerText: { color: "#ff5757", fontSize: 17, fontWeight: "bold" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#446158", fontSize: 17, fontWeight: "bold" },
  lightText: { color: "white", fontSize: 17, fontWeight: "bold" },
  readonlyNote: { fontSize: 15, color: "#446158", paddingHorizontal: 16, marginBottom: 4 },
  panel: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: "#f3f0d8" },
  panelText: { fontSize: 16, color: "black", marginBottom: 10 },
  error: { color: "#ff5757", fontSize: 16, marginTop: 8, paddingHorizontal: 16 },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  cancel: { marginTop: 24, alignItems: "center", padding: 12 },
  cancelText: { color: "#ff5757", fontSize: 17, fontWeight: "bold" },
});
