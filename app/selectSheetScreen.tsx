import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "../utils/fetchSpreadsheetData";

/**
 * 学習対象の品詞リスト
 * @typedef {Object} SheetData
 * @property {string} key - 品詞のキー
 * @property {string} label - 品詞のラベル
 */
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

/**
 * 品詞選択画面コンポーネント
 * @returns {JSX.Element} 品詞選択画面
 */
export default function SelectSheetScreen() {
  const router = useRouter();
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 全選択されているかどうかの判定
   * @type {boolean}
   */
  const isAllSelected = selectedSheets.length === sheetData.length;

  /**
   * 品詞選択のトグル
   * @param {string} sheet - 選択または解除する品詞のキー
   */
  const toggleSheetSelection = (sheet: string) => {
    setSelectedSheets((prev) =>
      prev.includes(sheet) ? prev.filter((s) => s !== sheet) : [...prev, sheet]
    );
  };

  /**
   * 選択された品詞に基づいてスプレッドシートからデータ取得後、学習画面に遷移
   * @returns {Promise<void>} 非同期処理
   */
  const handleStartLearning = async () => {
    if (selectedSheets.length === 0 || isLoading) return;
    setIsLoading(true);
    const results = await fetchSpreadsheetData(selectedSheets);
    setIsLoading(false);

    // 学習ページにデータを渡して遷移
    router.push({
      pathname: "/learnWords",
      params: { data: JSON.stringify(results) },
    });
  };

  /**
   * 画面UI
   * @returns {JSX.Element} 画面の構成要素
   */
  return (
    <View style={styles.container}>
      <FlatList
        data={sheetData}
        numColumns={2}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.flatListContainer}
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
            {/* 全選択／選択解除ボタン */}
            <TouchableOpacity
              style={[styles.button, styles.selectAllButton]}
              onPress={() =>
                setSelectedSheets(isAllSelected ? [] : sheetData.map((s) => s.key))
              }
            >
              <Text style={styles.buttonText}>
                {isAllSelected ? "選択解除" : "すべて選択"}
              </Text>
            </TouchableOpacity>

            {/* 学習開始ボタン */}
            <TouchableOpacity
              style={[styles.button, selectedSheets.length === 0 && styles.disabledButton]}
              disabled={selectedSheets.length === 0 || isLoading}
              onPress={handleStartLearning}
            >
              <Text style={styles.startButtonText}>学習を開始</Text>
            </TouchableOpacity>

            {/* トップに戻るボタン */}
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

/**
 * スタイル定義
 * @type {Object} スタイルオブジェクト
 */
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
