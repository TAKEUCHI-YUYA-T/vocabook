import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "../utils/fetchSpreadsheetData";

/**
 * メインコンポーネント関数
 * 
 * @returns {JSX.Element} LearnScreenコンポーネント
 */
export default function LearnScreen() {
  const router = useRouter();
  
  /**
   * 取得した全ての質問データを保持する状態
   * @type {string[][]}
   */
  const [allQuestions, setAllQuestions] = useState<string[][]>([]);
  
  /**
   * 現在の質問のインデックスを追跡する状態
   * @type {number}
   */
  const [currentIndex, setCurrentIndex] = useState(0);
  
  /**
   * 回答の表示・非表示を制御する状態
   * @type {boolean}
   */
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  
  /**
   * データ読み込み中かどうかを制御する状態
   * @type {boolean}
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 配列をシャッフルする関数
   * 
   * @param {string[][]} array シャッフル対象の2次元配列
   * @returns {string[][]} シャッフルされた配列
   */
  const shuffleArray = (array: string[][]) => {
    return array
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  };

  /**
   * スプレッドシートからデータを取得して状態を更新する非同期関数
   * 
   * @returns {Promise<void>} データ取得と状態更新の完了を表す非同期処理
   */
  const loadData = async () => {
    setIsLoading(true);
    setIsAnswerVisible(false);
    try {
      const sheetNames = ["ingOrTo"];
      const results = await fetchSpreadsheetData(sheetNames);
      const combinedData = results.flatMap((result) => result.data.slice(1));
      const shuffledData = shuffleArray(combinedData);
      setAllQuestions(shuffledData);
      setCurrentIndex(0);
    } catch (error) {
      console.error("データ取得エラー:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * 次の質問に進むための処理
   * 質問が最後の場合は、シャッフルして最初に戻る
   */
  const handleNext = () => {
    setIsAnswerVisible(false);
    if (currentIndex + 1 < allQuestions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // 最後まで行ったら再シャッフルしてリスタート
      const newQuestions = shuffleArray(allQuestions);
      setAllQuestions(newQuestions);
      setCurrentIndex(0);
    }
  };

  const currentRow = allQuestions[currentIndex] || null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Text style={styles.cellData}>読み込み中...</Text>
        ) : currentRow ? (
          <View style={styles.wordContainer}>
            {/* A列（常に表示） */}
            <View style={[styles.textRow, styles.abColumnContainer]}>
              <Text style={[styles.cellDataBold, { marginRight: 10 }]}>{currentRow[0]}</Text>
              <Text style={[styles.cellData, styles.underlined, isAnswerVisible ? styles.visibleText : styles.hiddenText]}>
                {currentRow[1]}
              </Text>
            </View>

            {/* C列～F列 */}
            <Text style={styles.cellData}>{currentRow[2]}</Text>
            <Text style={styles.cellData}>{currentRow[3]}</Text>
            {isAnswerVisible && <Text style={styles.cellData}>{currentRow[4]}</Text>}
            {isAnswerVisible && <Text style={styles.cellData}>{currentRow[5]}</Text>}
          </View>
        ) : (
          <Text style={styles.cellData}>データなし</Text>
        )}
      </ScrollView>

      {/* 進捗表示エリア */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {allQuestions.length > 0
            ? `問題 ${currentIndex + 1} / ${allQuestions.length}（${Math.round(
                ((currentIndex + 1) / allQuestions.length) * 100
              )}%）`
            : ""}
        </Text>
      </View>
    
      <View style={styles.buttonContainer}>
        {!isLoading && (
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
