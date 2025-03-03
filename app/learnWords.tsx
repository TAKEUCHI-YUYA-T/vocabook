import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "./fetchSpreadsheetData";

export default function LearnScreen() {
  const router = useRouter();
  const [randomRow, setRandomRow] = useState<string[] | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // ロード状態を追加

  const getRandomRow = async () => {
    setIsLoading(true); // データ取得開始
    setIsAnswerVisible(false); // 回答を非表示

    const sheetNames = ["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];
    
    // fetchSpreadsheetData はシート名の配列を受け取り、Promiseを返す
    const results = await fetchSpreadsheetData(sheetNames);

    // すべてのシートのデータを1つにまとめる
    const combinedData = results.flatMap(sheet => sheet.data.slice(1)); // ヘッダー行を除去

    if (combinedData.length > 0) {
      const randomIndex = Math.floor(Math.random() * combinedData.length);
      setRandomRow(combinedData[randomIndex]);
    }

    setIsLoading(false); // ロード完了
  };

  useEffect(() => {
    getRandomRow();
  }, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <Text style={styles.cellData}>読み込み中...</Text>
      ) : randomRow ? (
        <View style={styles.wordContainer}>
          <Text style={styles.cellDataBold}>{randomRow[0]}</Text> {/* A列: 太字 */}
          {isAnswerVisible && <Text style={styles.cellData}>{randomRow[1]}</Text>} {/* B列 */}
          <Text style={styles.cellData}>{randomRow[2]}</Text> {/* C列 */}
          {isAnswerVisible && <Text style={styles.cellData}>{randomRow[3]}</Text>} {/* D列 */}
          {isAnswerVisible && <Text style={styles.cellData}>{randomRow[4]}</Text>} {/* E列 */}
        </View>
      ) : (
        <Text style={styles.cellData}>データなし</Text>
      )}

      {!isLoading && (
        <>
          <TouchableOpacity style={styles.button} onPress={() => setIsAnswerVisible(true)}>
            <Text style={styles.buttonText}>回答</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.nextButton]} onPress={getRandomRow}>
            <Text style={styles.nextButtonText}>次へ</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.push("/")}>
        <Text style={styles.buttonText}>トップに戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fffeef"
  },
  wordContainer: {
    width: "80%",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    marginBottom: 10
  },
  cellData: {
    fontSize: 18,
    color: "black",
    marginBottom: 5
  },
  cellDataBold: {
    fontSize: 18,
    color: "black",
    fontWeight: "bold",
    marginBottom: 5
  },
  linkText: {
    fontSize: 18,
    color: "blue",
    textDecorationLine: "underline"
  },
  button: {
    backgroundColor: "gray",
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: "80%",
    alignItems: "center"
  },
  nextButton:{
    backgroundColor: "#9fd700"
  },
  nextButtonText: {
    color: "#446158",
    fontSize: 18,
    fontWeight: "bold"
  },
  backButton: {
    backgroundColor: "#ff5757"
    
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight:
    "bold"
  }
});
