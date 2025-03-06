// pages/learn-words.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { fetchSpreadsheetData } from "../utils/fetchSpreadsheetData";

export default function LearnScreen() {
  const router = useRouter();
  const { sheets } = useLocalSearchParams<{ sheets?: string }>();
  const selectedSheets = sheets ? sheets.split(",") : [];

  const [randomRow, setRandomRow] = useState<string[] | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getRandomRow = async () => {
    setIsLoading(true);
    setIsAnswerVisible(false);

    if (selectedSheets.length === 0) {
      setIsLoading(false);
      return;
    }

    const results = await fetchSpreadsheetData(selectedSheets);
    const combinedData = results.flatMap(sheet => sheet.data.slice(1));

    if (combinedData.length > 0) {
      const randomIndex = Math.floor(Math.random() * combinedData.length);
      setRandomRow(combinedData[randomIndex]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    getRandomRow();
  }, [sheets]);

  return (
    <View style={styles.container}>
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

      <View style={styles.buttonContainer}>
        {!isLoading && (
          <>
            <TouchableOpacity style={styles.button} onPress={() => setIsAnswerVisible(true)}>
              <Text style={styles.buttonText}>回答</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={getRandomRow}>
              <Text style={styles.buttonText}>次へ</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.button, styles.backSelectSheetScreenButton]} onPress={() => router.push("/SelectSheetScreen")}>
          <Text style={styles.backSelectSheetScreenButtonText}>シート選択に戻る</Text>
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
  }
});
