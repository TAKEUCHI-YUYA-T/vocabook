import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

/**
 * 学習画面（LearnScreen）
 * ランダムなクイズを表示し、「回答」ボタンで答えを確認、
 * 「次へ」ボタンで次の問題に進む
 * 現在の問題番号と進捗率（％）も表示
 */
export default function LearnScreen() {
  const router = useRouter();
  const { sheets, data } = useLocalSearchParams<{ sheets?: string; data?: string }>();

  const selectedSheets = sheets ? sheets.split(",") : [];

  const [quizList, setQuizList] = useState<string[][]>([]);
  const [randomRow, setRandomRow] = useState<string[] | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentIndexRef = useRef(0);

  /**
   * データ受け取り後にパースし、問題リストをシャッフルしてセット
   */
  useEffect(() => {
    if (data) {
      let parsedData = [];

      if (typeof data === "string") {
        try {
          parsedData = JSON.parse(data);
        } catch (error) {
          console.error("Failed to parse data:", error);
          return;
        }
      }

      if (Array.isArray(parsedData)) {
        const combinedData = parsedData.flatMap((sheet: any) => {
          if (Array.isArray(sheet.data) && sheet.data.length > 1) {
            return sheet.data.slice(1); // ヘッダー行を除外
          }
          return [];
        });

        if (combinedData.length > 0) {
          const shuffled = shuffleArray(combinedData);
          setQuizList(shuffled);
          currentIndexRef.current = 0;
          setRandomRow(shuffled[0]);
        }
      }
    }
  }, [data]);

  /**
   * 配列のシャッフル関数（Fisher–Yatesアルゴリズム）
   */
  function shuffleArray(array: any[]) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 「次へ」ボタン押下時の処理
   * 最後まで行ったら再シャッフルしてリセット
   */
  const handleNextQuestion = () => {
    const nextIndex = currentIndexRef.current + 1;

    if (nextIndex >= quizList.length) {
      const reshuffled = shuffleArray(quizList);
      setQuizList(reshuffled);
      currentIndexRef.current = 0;
      setRandomRow(reshuffled[0]);
    } else {
      currentIndexRef.current = nextIndex;
      setRandomRow(quizList[nextIndex]);
    }

    setIsAnswerVisible(false);
  };

  /**
   * 画面UI
   */
  return (
    <View style={styles.container}>
      {/* 問題表示エリア */}
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Text style={styles.cellData}>読み込み中...</Text>
        ) : randomRow ? (
          <View style={styles.wordContainer}>
            <Text style={styles.cellDataBold}>{randomRow[0]}</Text>
            {isAnswerVisible && <Text style={styles.cellData}>{randomRow[1]}</Text>}
            <Text style={styles.cellData}>{randomRow[2]}</Text>
            {isAnswerVisible && <Text style={styles.cellData}>{randomRow[3]}</Text>}
            {isAnswerVisible && <Text style={styles.cellData}>{randomRow[4]}</Text>}
          </View>
        ) : (
          <Text style={styles.cellData}>データなし</Text>
        )}
      </ScrollView>

      {/* 進捗表示エリア */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {quizList.length > 0
            ? `問題 ${currentIndexRef.current + 1} / ${quizList.length}（${Math.round(
                ((currentIndexRef.current + 1) / quizList.length) * 100
              )}%）`
            : ""}
        </Text>
      </View>

      {/* 操作ボタン */}
      <View style={styles.buttonContainer}>
        {!isLoading && (
          <>
            <TouchableOpacity style={styles.button} onPress={() => setIsAnswerVisible(true)}>
              <Text style={styles.buttonText}>回答</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleNextQuestion}>
              <Text style={styles.buttonText}>次へ</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, styles.backSelectSheetScreenButton]}
          onPress={() => router.push("/selectSheetScreen")}
        >
          <Text style={styles.backSelectSheetScreenButtonText}>品詞選択に戻る</Text>
        </TouchableOpacity>

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
  backSelectSheetScreenButton: {
    backgroundColor: "#446158",
  },
  backSelectSheetScreenButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  topButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
