import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderTextButton, ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import { CardForm, emptyCardForm, type CardFormValue } from "@/components/CardForm";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useDuplicateWarning } from "@/hooks/useDuplicateWarning";
import { useGoBack } from "@/hooks/useGoBack";

/** 「追加しました」の表示を出しておく時間（ミリ秒） */
const NOTICE_MS = 2500;

/**
 * 単語の追加画面
 * 「保存したら、続けて追加する」がオンなら、保存のあとも画面に残り、品詞を引き継いで次の単語を入力できる
 */
export default function NewCardScreen() {
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/words");
  const { deck, error: deckError } = useDefaultDeck();

  const [value, setValue] = useState<CardFormValue>(emptyCardForm());
  const [formKey, setFormKey] = useState(0);
  const [continueAdding, setContinueAdding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicateWarning = useDuplicateWarning(repository, deck?.id, value.term);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = (text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  const save = async () => {
    if (isSaving || !deck) return;
    setIsSaving(true);
    try {
      const card = await repository.addCard(deck.id, value);
      setError(null);
      if (continueAdding) {
        showNotice(`「${card.term}」を追加しました`);
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
      <ScreenHeader
        title="単語を追加"
        onBack={goBack}
        backIcon="close"
        backLabel="閉じる"
        bordered
        right={<HeaderTextButton label="保存" onPress={save} disabled={isSaving || !deck} />}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CardForm key={formKey} value={value} onChange={setValue} editable autoFocus duplicateWarning={duplicateWarning} />

        {!!(error ?? deckError) && <Text style={styles.error}>{error ?? deckError}</Text>}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>保存したら、続けて追加する</Text>
          <Switch
            value={continueAdding}
            onValueChange={setContinueAdding}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="保存したら、続けて追加する"
          />
        </View>
      </ScrollView>

      {!!notice && (
        <View style={[styles.snackbar, { bottom: insets.bottom + 28 }]} accessibilityRole="alert">
          <Feather name="check" size={20} color={colors.primary} />
          <Text style={styles.snackbarText}>{notice}</Text>
        </View>
      )}
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
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  switchLabel: { flex: 1, fontSize: 15, color: colors.text },
  snackbar: {
    position: "absolute",
    left: 16,
    right: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    elevation: 6,
  },
  snackbarText: { flex: 1, fontSize: 15, color: colors.onSecondary },
});
