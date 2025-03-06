import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList
} from "react-native";
import { useRouter } from "expo-router";

const sheetData = [
  { key: "noun", label: "名詞" },
  { key: "verb", label: "動詞" },
  { key: "adverb", label: "副詞" },
  { key: "adjective", label: "形容詞" },
  { key: "preposition", label: "前置詞" },
  { key: "conjunction", label: "接続詞" },
  { key: "auxiliaryVerb", label: "助動詞" },
  { key: "idiom", label: "熟語" },
];

export default function SelectSheetScreen() {
  const router = useRouter();
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);

  const toggleSheetSelection = (sheet: string) => {
    setSelectedSheets((prev) =>
      prev.includes(sheet) ? prev.filter((s) => s !== sheet) : [...prev, sheet]
    );
  };

  return (
<View style={styles.container}>
  <FlatList
    data={sheetData}
    numColumns={2}
    keyExtractor={(item) => item.key}
    contentContainerStyle={styles.flatListContainer} // alignItemsを削除
    ListHeaderComponent={() => (
      <Text style={styles.title}>学習する品詞を選択してください</Text>
    )}
    renderItem={({ item }) => (
      <TouchableOpacity
        onPress={() => toggleSheetSelection(item.key)}
        style={[
          styles.sheetButton,
          selectedSheets.includes(item.key) && styles.selectedSheet,
        ]}
      >
        <Text
          style={[
            styles.sheetText,
            selectedSheets.includes(item.key) && styles.selectedText,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    )}
    ListFooterComponent={() => (
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.selectAllButton]}
          onPress={() => setSelectedSheets(sheetData.map((s) => s.key))}
        >
          <Text style={styles.buttonText}>すべて選択</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.startButton,
            selectedSheets.length === 0 && styles.disabledButton,
          ]}
          onPress={() =>
            router.push({ pathname: "/learnWords", params: { sheets: selectedSheets.join(",") } })
          }
          disabled={selectedSheets.length === 0}
        >
          <Text style={styles.startButtonText}>学習を開始</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.buttonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>
    )}
  />
</View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#fffeef",
      alignItems: "center",
      justifyContent: "center",
    },
    flatListContainer: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      textAlign: "center",
    },
    sheetButton: {
      flex: 1,
      minWidth: 100,
      maxWidth: "48%",
      paddingVertical: 12,
      margin: 5,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "gray",
      borderRadius: 10,
    },
    selectedSheet: {
      backgroundColor: "#9fd700",
    },
    sheetText: {
      fontSize: 18,
      color: "black",
    },
    selectedText: {
      color: "white",
      fontWeight: "bold",
    },
    footer: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      marginTop: "auto",
      paddingBottom: 20,
      alignSelf: "stretch",
    },
    button: {
      backgroundColor: "#9fd700",
      padding: 15,
      borderRadius: 10,
      marginVertical: 5,
      width: "90%",
      alignItems: "center",
    },
    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },
    selectAllButton: {
      backgroundColor: "#446158",
    },
    startButton: {
      backgroundColor: "#9fd700",
    },
    startButtonText: {
      color: "#446158",
      fontSize: 18,
      fontWeight: "bold",
    },
    disabledButton: {
      backgroundColor: "gray",
    },
    backButton: {
      backgroundColor: "#ff5757",
    },
  });
  