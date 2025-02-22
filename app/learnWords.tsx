import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { useRouter } from "expo-router";

export const fetchSpreadsheetData = async (sheetType: string) => {
  try {
    const response = await fetch(`http://192.168.100.102:3001/api/google-sheets/${sheetType}`);
    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error(`Google Sheets API エラー (${sheetType}):`, error);
    return [];
  }
};

export default function LearnScreen() {
  const router = useRouter();
  const [randomRow, setRandomRow] = useState<string[] | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // ロード状態を追加

  const getRandomRow = async () => {
    setIsLoading(true); // データ取得開始
    setIsAnswerVisible(false); // 回答を非表示

    const sheetTypes = ["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];
    const promises = sheetTypes.map(type => fetchSpreadsheetData(type));
    const results = await Promise.all(promises);

    // 取得したデータの1行目（ヘッダー）を除外
    const combinedData = results.flatMap(data => data.slice(1));

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
            <Text style={styles.buttonText}>次へ</Text>
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
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  wordContainer: { width: "80%", alignItems: "flex-start", paddingHorizontal: 10, marginBottom: 10 },
  cellData: { fontSize: 18, color: "black", marginBottom: 5 },
  cellDataBold: { fontSize: 18, color: "black", fontWeight: "bold", marginBottom: 5 },
  linkText: { fontSize: 18, color: "blue", textDecorationLine: "underline" },
  button: { backgroundColor: "gray", padding: 15, borderRadius: 10, marginVertical: 5, width: "80%", alignItems: "center" },
  nextButton: { backgroundColor: "green" },
  backButton: { backgroundColor: "red" },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
