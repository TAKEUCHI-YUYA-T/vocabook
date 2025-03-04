import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "./fetchSpreadsheetData";

export default function LearnScreen() {
  const router = useRouter();
  const [randomRow, setRandomRow] = useState<string[] | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getRandomRow = async () => {
    setIsLoading(true);
    setIsAnswerVisible(false);

    const sheetNames = ["ingOrTo"];

    try {
      const results = await fetchSpreadsheetData(sheetNames);
      const combinedData = results.flatMap((result) => result.data.slice(1));

      if (combinedData.length > 0) {
        const randomIndex = Math.floor(Math.random() * combinedData.length);
        setRandomRow(combinedData[randomIndex]);
      } else {
        throw new Error("データが空です");
      }
    } catch (error) {
      console.error("データ取得エラー:", error);
      setRandomRow(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    getRandomRow();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
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
      </ScrollView>

      {/* ボタンを統一した配置に */}
      <View style={styles.buttonContainer}>
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
    backgroundColor: "gray",
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: "80%",
    alignItems: "center",
  },
  nextButton: {
    backgroundColor: "#9fd700",
  },
  nextButtonText: {
    color: "#446158",
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    backgroundColor: "#ff5757",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
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
});
