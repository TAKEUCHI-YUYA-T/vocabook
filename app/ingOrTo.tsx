import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
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
  const [isLoading, setIsLoading] = useState(true);

  const getRandomRow = async () => {
    setIsLoading(true);
    setIsAnswerVisible(false);

    const sheetTypes = ["ingOrTo"];
    const promises = sheetTypes.map(type => fetchSpreadsheetData(type));
    const results = await Promise.all(promises);

    const combinedData = results.flatMap(data => data.slice(1));

    if (combinedData.length > 0) {
      const randomIndex = Math.floor(Math.random() * combinedData.length);
      setRandomRow(combinedData[randomIndex]);
    }

    setIsLoading(false);
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
          {/* A列（常に表示） */}
          <View style={[styles.textRow, styles.abColumnContainer]}>
            <Text style={[styles.cellDataBold, { marginRight: 10 }]}>{randomRow[0]}</Text>
            <Text style={[styles.cellData, styles.underlined, isAnswerVisible ? styles.visibleText : styles.hiddenText]}>
                {randomRow[1]}
            </Text>
          </View>
          {/* C列～F列 */}
          <Text style={styles.cellData}>{randomRow[2]}</Text>
          <Text style={styles.cellData}>{randomRow[3]}</Text>
          {isAnswerVisible && <Text style={styles.cellData}>{randomRow[4]}</Text>}
          {isAnswerVisible && <Text style={styles.cellData}>{randomRow[5]}</Text>}
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
  textRow: { flexDirection: "row", alignItems: "center" }, // 🔹 A列とB列を横並びに
  cellData: { fontSize: 18, color: "black", marginBottom: 0 }, // 🔹 余白をなくす
  cellDataBold: { fontSize: 18, color: "black", fontWeight: "bold", marginBottom: 0 }, // 🔹 余白をなくす
  button: { backgroundColor: "gray", padding: 15, borderRadius: 10, marginVertical: 5, width: "80%", alignItems: "center" },
  nextButton: { backgroundColor: "green" },
  backButton: { backgroundColor: "red" },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  underlined: {
    borderBottomWidth: 2,
    borderBottomColor: "green",
    paddingBottom: 2, // 文字と下線がくっつかないようにする
    minWidth: 50, // 🔹 下線の長さを確保（データが短い場合も考慮）
    textAlign: "center", // 🔹 中央寄せで見た目を調整
  },
  hiddenText: {
    color: "transparent", // 🔹 最初は透明にして見えなくする
  },
  visibleText: {
    color: "black", // 🔹 ボタン押下後に表示
  },
  abColumnContainer: {
    marginBottom: 10, // 🔹 A,B列とC～F列の間の余白を広げる
  }
});
