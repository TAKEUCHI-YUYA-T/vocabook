import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { HeaderIconButton } from "@/components/ScreenHeader";
import { QuizFrame } from "@/components/QuizFrame";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import { partOfSpeechLabel, PARTS_OF_SPEECH, type Card, type PartOfSpeech } from "@/db/types";
import { useGoBack } from "@/hooks/useGoBack";

/**
 * 学習画面
 * 条件（単語帳と品詞）に合う単語を DB から読み、ランダムな順に出題する
 * 答えを出す操作は、下の「答えを見る」ボタンだけ。見たあとは同じボタンが「次へ」になる
 */
export default function LearnScreen() {
  const router = useRouter();
  const repository = useRepository();
  const goBack = useGoBack("/study");
  const { decks, parts } = useLocalSearchParams<{ decks?: string; parts?: string }>();

  const [quiz, setQuiz] = useState<QuizState<Card> | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 条件が変わったときに、問題を読み直す
   * 編集画面から戻ったときは、出題の途中経過を保ったまま、最新の内容に差し替える
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const deckIds = (decks ?? "").split(",").filter(Boolean);
      const partsOfSpeech = (parts ?? "")
        .split(",")
        .filter((p): p is PartOfSpeech => PARTS_OF_SPEECH.some((part) => part.key === p));

      repository
        .listStudyCards({ deckIds, partsOfSpeech })
        .then((cards) => {
          if (!active) return;
          setError(null);
          setQuiz((prev) => {
            if (!prev) return startQuiz(cards);
            // すでに出題中なら、順番を保ったまま、内容だけ最新にする（削除された単語は除く）
            const latest = new Map(cards.map((card) => [card.id, card]));
            const order = prev.order.filter((card) => latest.has(card.id)).map((card) => latest.get(card.id) as Card);
            return { ...prev, order, index: Math.min(prev.index, Math.max(order.length - 1, 0)) };
          });
        })
        .catch(() => active && setError("単語を読み込めませんでした"));
      return () => {
        active = false;
      };
    }, [repository, decks, parts])
  );

  const current = quiz && quiz.order.length > 0 ? quiz.order[quiz.index] : null;

  const handleNext = () => {
    setQuiz((prev) => (prev ? nextQuestion(prev) : prev));
    setIsAnswerVisible(false);
  };

  const message = error ?? (!quiz ? "読み込み中..." : current ? null : "この条件に合う単語がありません");
  const hasAnswerDetails = !!current && (!!current.meaning || !!current.exampleTranslation || !!current.note);

  return (
    <QuizFrame
      title="学習"
      onBack={goBack}
      backLabel="学習の範囲に戻る"
      progress={quiz && current ? progress(quiz) : null}
      headerExtra={
        current ? (
          <HeaderIconButton icon="edit-2" label="この単語を編集" onPress={() => router.push({ pathname: "/cards/[id]", params: { id: current.id } })} />
        ) : undefined
      }
      action={current ? (isAnswerVisible ? { kind: "next", onPress: handleNext } : { kind: "reveal", onPress: () => setIsAnswerVisible(true) }) : null}
      message={message}
    >
      {!!current && (
        <>
          {!!current.partOfSpeech && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{partOfSpeechLabel(current.partOfSpeech)}</Text>
            </View>
          )}
          <Text style={styles.term}>{current.term}</Text>
          {!!current.example && <Text style={styles.example}>{current.example}</Text>}

          {isAnswerVisible && hasAnswerDetails && (
            <View style={styles.answer}>
              {!!current.meaning && (
                <>
                  <Text style={styles.label}>意味</Text>
                  <Text style={styles.meaning}>{current.meaning}</Text>
                </>
              )}
              {!!current.exampleTranslation && (
                <>
                  <Text style={[styles.label, styles.labelGap]}>例文の訳</Text>
                  <Text style={styles.translation}>{current.exampleTranslation}</Text>
                </>
              )}
              {!!current.note && (
                <>
                  <Text style={[styles.label, styles.labelGap]}>メモ</Text>
                  <Text style={styles.translation}>{current.note}</Text>
                </>
              )}
            </View>
          )}
        </>
      )}
    </QuizFrame>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.secondary, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  tagText: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  term: { fontSize: 32, fontWeight: "bold", lineHeight: 40, color: colors.text },
  example: { fontSize: 16, lineHeight: 27, color: colors.text },
  answer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 4, gap: 12 },
  label: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  labelGap: { marginTop: 4 },
  meaning: { fontSize: 20, fontWeight: "bold", lineHeight: 30, color: colors.text },
  translation: { fontSize: 15, lineHeight: 26, color: colors.text },
});
