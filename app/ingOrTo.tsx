import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import type { Card } from "@/db/types";

/**
 * ing or to の画面
 * 動詞のあとに ing と to のどちらが続くかを答える。問題は DB（標準の「ing or to」）から読む
 */
export default function IngOrToScreen() {
  const router = useRouter();
  const repository = useRepository();

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
  const status = quiz ? progress(quiz) : { current: 0, total: 0, percent: 0 };
  const answerLabel = current?.answer === "ing" ? "～ing" : current?.answer === "to" ? "to～" : "";

  const handleNext = () => {
    setQuiz((prev) => (prev ? nextQuestion(prev) : prev));
    setIsAnswerVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {error ? (
          <Text style={styles.cellData}>{error}</Text>
        ) : !quiz ? (
          <Text style={styles.cellData}>読み込み中...</Text>
        ) : current ? (
          <View style={styles.wordContainer}>
            {/* 動詞と、答え（ing / to）の欄。答えは「回答」を押すまで隠す */}
            <View style={[styles.textRow, styles.abColumnContainer]}>
              <Text style={[styles.cellDataBold, { marginRight: 10 }]}>{current.term}</Text>
              <Text style={[styles.cellData, styles.underlined, isAnswerVisible ? styles.visibleText : styles.hiddenText]}>
                {answerLabel}
              </Text>
            </View>

            {!!current.meaning && <Text style={styles.cellData}>{current.meaning}</Text>}
            {!!current.example && <Text style={styles.cellData}>{current.example}</Text>}
            {isAnswerVisible && !!current.note && <Text style={styles.cellData}>{current.note}</Text>}
          </View>
        ) : (
          <Text style={styles.cellData}>データなし</Text>
        )}
      </ScrollView>

      {/* 進捗表示エリア */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {status.total > 0 ? `問題 ${status.current} / ${status.total}（${status.percent}%）` : ""}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {current && (
          <>
            <TouchableOpacity style={styles.button} onPress={() => setIsAnswerVisible(true)}>
              <Text style={styles.buttonText}>回答</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>次へ</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.push("/")}>
          <Text style={styles.topButtonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffeef",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  wordContainer: {
    width: "80%",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cellData: {
    fontSize: 18,
    color: "black",
    marginBottom: 5,
  },
  cellDataBold: {
    fontSize: 18,
    color: "black",
    fontWeight: "bold",
    marginBottom: 5,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 20,
  },
  button: {
    backgroundColor: "#9fd700",
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#446158",
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    backgroundColor: "#ff5757",
  },
  underlined: {
    borderBottomWidth: 2,
    borderBottomColor: "#446158",
    paddingBottom: 2,
    minWidth: 50,
    textAlign: "center",
  },
  hiddenText: {
    color: "transparent",
  },
  visibleText: {
    color: "black",
  },
  abColumnContainer: {
    marginBottom: 10,
  },
  topButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  progressContainer: {
    color: "#446158",
    alignItems: "center",
    marginBottom: 10,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#446158",
    marginBottom: 10,
  },
});
