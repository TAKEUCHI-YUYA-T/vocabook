import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { QuizFrame } from "@/components/QuizFrame";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import { ingOrToLabel, type Card } from "@/db/types";
import { useGoBack } from "@/hooks/useGoBack";

/**
 * ing or to の画面
 * 動詞のあとに ing と to のどちらが続くかを答える。問題は DB から読む
 * （アプリに同梱した問題と、単語帳で「ing or to の問題」に答えを付けた自分の単語）
 * 答えを出す操作は、下の「答えを見る」ボタンだけ。見たあとは同じボタンが「次へ」になる
 */
export default function IngOrToScreen() {
  const repository = useRepository();
  const goBack = useGoBack("/");

  const [quiz, setQuiz] = useState<QuizState<Card> | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    repository
      .listIngOrToCards()
      .then((cards) => active && setQuiz(startQuiz(cards)))
      .catch(() => active && setError("問題を読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository]);

  const current = quiz && quiz.order.length > 0 ? quiz.order[quiz.index] : null;
  const answerLabel = ingOrToLabel(current?.answer);

  const handleNext = () => {
    setQuiz((prev) => (prev ? nextQuestion(prev) : prev));
    setIsAnswerVisible(false);
  };

  const message = error ?? (!quiz ? "読み込み中..." : current ? null : "データなし");

  return (
    <QuizFrame
      title="ing or to"
      onBack={goBack}
      backLabel="ホームに戻る"
      progress={quiz && current ? progress(quiz) : null}
      action={current ? (isAnswerVisible ? { kind: "next", onPress: handleNext } : { kind: "reveal", onPress: () => setIsAnswerVisible(true) }) : null}
      message={message}
    >
      {!!current && (
        <>
          <Text style={styles.prompt}>あとに続くのは「～ing」？「to～」？</Text>

          {/* 動詞と、答え（ing / to）の欄。答えは、文字の色で隠すのではなく、「答えを見る」を押すまで文字そのものを描画しない（下線の欄だけを残す） */}
          <View style={styles.questionRow}>
            <Text style={styles.term}>{current.term}</Text>
            <View style={styles.answerBlank}>{isAnswerVisible && <Text style={styles.answerText}>{answerLabel}</Text>}</View>
          </View>

          {!!current.meaning && <Text style={styles.meaning}>{current.meaning}</Text>}

          {/* 例文には答え（～ing / to～）がそのまま入っているので、答えと一緒に出す */}
          {isAnswerVisible && (
            <View style={styles.answerPanel}>
              {!!answerLabel && (
                <Text style={styles.answerSentence}>
                  {current.term} のあとは、<Text style={styles.answerStrong}>{answerLabel}</Text>
                </Text>
              )}
              {!!current.examples[0]?.text && <Text style={styles.example}>{current.examples[0].text}</Text>}
              {!!current.note && <Text style={styles.answerNote}>{current.note}</Text>}
            </View>
          )}
        </>
      )}
    </QuizFrame>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 14, fontWeight: "bold", color: colors.secondary },
  questionRow: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 14 },
  term: { fontSize: 34, fontWeight: "bold", lineHeight: 41, color: colors.text },
  answerBlank: {
    minWidth: 120,
    height: 48,
    borderBottomWidth: 3,
    borderBottomColor: colors.secondary,
    paddingBottom: 2,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  answerText: { fontSize: 28, fontWeight: "bold", color: colors.secondary },
  meaning: { fontSize: 17, lineHeight: 27, color: colors.text },
  example: { fontSize: 16, lineHeight: 26, color: colors.text },
  answerPanel: { marginTop: "auto", backgroundColor: colors.panel, borderRadius: 14, padding: 16, gap: 8 },
  answerSentence: { fontSize: 15, lineHeight: 24, color: colors.text },
  answerStrong: { fontWeight: "bold" },
  answerNote: { fontSize: 15, lineHeight: 24, color: colors.text },
});
