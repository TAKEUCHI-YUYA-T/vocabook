import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import { partOfSpeechLabel, PARTS_OF_SPEECH, type Card, type PartOfSpeech } from "@/db/types";

/**
 * 学習画面
 * 条件（単語帳と品詞）に合う単語を DB から読み、ランダムな順に出題する
 * 「回答」で意味・例文の訳・補足を表示し、「次へ」で次の問題へ進む
 */
export default function LearnScreen() {
  const router = useRouter();
  const repository = useRepository();
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
  const status = quiz ? progress(quiz) : { current: 0, total: 0, percent: 0 };

  const handleNext = () => {
    setQuiz((prev) => (prev ? nextQuestion(prev) : prev));
    setIsAnswerVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {error ? (
          <Text style={styles.cellData}>{error}</Text>
        ) : !quiz ? (
          <Text style={styles.cellData}>読み込み中...</Text>
        ) : current ? (
          <View style={styles.wordContainer}>
            <Text style={styles.cellDataBold}>{current.term}</Text>
            {!!current.partOfSpeech && <Text style={styles.partOfSpeech}>{partOfSpeechLabel(current.partOfSpeech)}</Text>}
            {isAnswerVisible && !!current.meaning && <Text style={styles.cellData}>{current.meaning}</Text>}
            {!!current.example && <Text style={styles.cellData}>{current.example}</Text>}
            {isAnswerVisible && !!current.exampleTranslation && <Text style={styles.cellData}>{current.exampleTranslation}</Text>}
            {isAnswerVisible && !!current.note && <Text style={styles.cellData}>{current.note}</Text>}
          </View>
        ) : (
          <Text style={styles.cellData}>この条件に合う単語がありません</Text>
        )}
      </ScrollView>

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
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => router.push({ pathname: "/cards/[id]", params: { id: current.id } })}
            >
              <Text style={styles.lightButtonText}>この単語を編集</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={[styles.button, styles.backSelectButton]} onPress={() => router.replace("/study")}>
          <Text style={styles.lightButtonText}>範囲選択に戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/")}>
          <Text style={styles.lightButtonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 20 },
  wordContainer: { width: "80%", alignItems: "flex-start", paddingHorizontal: 10, marginBottom: 10 },
  cellData: { fontSize: 18, color: "black", marginBottom: 5 },
  cellDataBold: { fontSize: 18, color: "black", fontWeight: "bold", marginBottom: 5 },
  partOfSpeech: { fontSize: 14, color: "#446158", marginBottom: 8 },
  progressContainer: { alignItems: "center", marginBottom: 10 },
  progressText: { fontSize: 16, fontWeight: "600", color: "#446158", marginBottom: 10 },
  buttonContainer: { width: "100%", alignItems: "center", paddingBottom: 20 },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, marginVertical: 5, width: "80%", alignItems: "center" },
  buttonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
  lightButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  editButton: { backgroundColor: "#7a8f88" },
  backSelectButton: { backgroundColor: "#446158" },
  backButton: { backgroundColor: "#ff5757" },
});
