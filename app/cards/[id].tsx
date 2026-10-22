import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderTextButton, ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import type { Card, Deck } from "@/db/types";
import { CardForm, type CardFormValue } from "@/components/CardForm";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";
import { useGoBack } from "@/hooks/useGoBack";

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
 * - 同梱の読み取り専用の単語（ing or to など）: 見るだけ
 */
export default function EditCardScreen() {
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/words");
  const { id } = useLocalSearchParams<{ id: string }>();

  const [card, setCard] = useState<Card | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [value, setValue] = useState<CardFormValue | null>(null);
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
        <ScreenHeader title="単語を編集" onBack={goBack} backLabel="戻る" bordered />
        <Text style={styles.message}>{error ?? (isLoaded ? "この単語は見つかりませんでした（削除された可能性があります）" : "読み込み中...")}</Text>
      </View>
    );
  }

  const editable = deck?.kind === "user";

  const save = () =>
    run(async () => {
      await repository.updateCard(card.id, value);
      goBack();
    });

  const confirmDelete = () =>
    Alert.alert("この単語を削除しますか？", `「${card.term}」を削除します。`, [
      { text: "やめる", style: "cancel" },
      {
        text: "削除する",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await repository.deleteCard(card.id);
            goBack();
          }),
      },
    ]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={editable ? "単語を編集" : "単語の詳細"}
        onBack={goBack}
        backLabel={editable ? "保存せずに戻る" : "戻る"}
        bordered
        right={editable ? <HeaderTextButton label="保存" onPress={save} disabled={isSaving} /> : undefined}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {!editable && <Text style={styles.readonlyNote}>この単語は編集できません。</Text>}

        <CardForm value={value} onChange={setValue} editable={editable} expanded duplicateWarning={editable ? duplicateWarning : null} />

        {!!error && <Text style={styles.error}>{error}</Text>}

        {editable && (
          <TouchableOpacity accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete} disabled={isSaving}>
            <Feather name="trash-2" size={20} color={colors.danger} />
            <Text style={styles.deleteText}>この単語を削除</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 14, gap: 14 },
  message: { fontSize: 16, color: colors.secondary, textAlign: "center", marginTop: 40, paddingHorizontal: 16 },
  readonlyNote: { fontSize: 15, color: colors.secondary },
  error: { color: colors.danger, fontSize: 15 },
  deleteButton: {
    minHeight: 50,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  deleteText: { fontSize: 16, fontWeight: "bold", color: colors.text },
});
