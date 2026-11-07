import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { AdBanner } from "@/components/AdBanner";
import { HeaderTextButton, ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import { CardForm, emptyCardForm, type CardFormValue } from "@/components/CardForm";
import { useCardAutoFill } from "@/hooks/useCardAutoFill";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";
import { useGoBack } from "@/hooks/useGoBack";
import { useBaseFormSuggestion } from "@/hooks/useBaseFormSuggestion";
import { useSpellingWarning } from "@/hooks/useSpellingWarning";

/**
 * 単語の追加画面
 * 「保存したら、続けて追加する」がオンなら、保存のあとも画面に残り、品詞を引き継いで次の単語を入力できる
 */
export default function NewCardScreen() {
  const repository = useRepository();
  const toast = useToast();
  const goBack = useGoBack("/words");
  const { deck, error: deckError } = useDefaultDeck();

  const [value, setValue] = useState<CardFormValue>(emptyCardForm());
  const [formKey, setFormKey] = useState(0);
  const [continueAdding, setContinueAdding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const duplicateWarning = useDuplicateWarning(repository, deck?.id, value.term);
  const autoFill = useCardAutoFill(value, setValue);
  const spellingWarning = useSpellingWarning(value.term);
  const baseFormSuggestions = useBaseFormSuggestion(value.term);

  const save = async () => {
    if (isSaving || !deck) return;
    setIsSaving(true);
    try {
      const card = await repository.addCard(deck.id, value);
      setError(null);
      toast.show({ message: `「${card.term}」を追加しました` });
      if (continueAdding) {
        // 品詞は、あなたが選んだものだけを引き継ぐ（自動で入った品詞は、次の単語で推定し直す）
        setValue(emptyCardForm(value.partOfSpeech === autoFill.autoPartOfSpeech ? null : value.partOfSpeech));
        autoFill.reset();
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
      <ScreenHeader
        title="単語を追加"
        onBack={goBack}
        backIcon="close"
        backLabel="閉じる"
        right={<HeaderTextButton label="保存" onPress={save} disabled={isSaving || !deck} />}
      />

      <AdBanner />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CardForm key={formKey} value={value} onChange={setValue} editable autoFocus duplicateWarning={duplicateWarning} spellingWarning={spellingWarning} baseFormSuggestions={baseFormSuggestions} autoFill={autoFill} />

        {!!(error ?? deckError) && <Text style={styles.error}>{error ?? deckError}</Text>}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>保存したら、続けて追加する</Text>
          <Switch
            value={continueAdding}
            onValueChange={setContinueAdding}
            trackColor={{ true: colors.primary, false: colors.fillStrong }}
            thumbColor={colors.surface}
            accessibilityLabel="保存したら、続けて追加する"
          />
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120, gap: 18 },
  error: { color: colors.danger, fontSize: 15 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  switchLabel: { flex: 1, fontSize: 17, color: colors.text },
});
