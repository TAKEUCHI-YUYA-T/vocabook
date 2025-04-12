import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Dimensions, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "../utils/fetchSpreadsheetData";

/**
 * メインコンポーネント
 * - スプレッドシートからデータを取得し、表示する
 * - 画面上にアニメーションを使った 絵文字を表示する
 *
 * @returns {JSX.Element} レンダリングされたコンポーネント
 */
export default function App() {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [dogs, setDogs] = useState<{ id: number; x: number; anim: Animated.Value }[]>([]);

  const { width, height } = Dimensions.get("window");

  /**
   * 初回レンダリング時にスプレッドシートからデータを取得
   * - 取得したデータをシャッフルし、1行目のみ表示
   */
  useEffect(() => {
    const getData = async () => {
      setLoading(true); // 読み込み中に設定
      const sheetNames = ["reference"]; // 読み込むシート名
      const response = await fetchSpreadsheetData(sheetNames); // シートデータを取得

      // 取得したデータが有効か確認
      if (Array.isArray(response) && response.length > 0) {
        const referenceData = response.find(sheet => sheet.sheetType === "reference")?.data ?? [];

        if (Array.isArray(referenceData) && referenceData.length > 1) {
          // 1行目はヘッダーなので、データ部分だけを取り出し、シャッフルして表示
          const filteredData = referenceData.slice(1).filter(row => row.length > 0 && row[0]?.trim() !== "");
          const shuffledData = shuffleArray(filteredData); // 配列をシャッフル
          setRows(shuffledData.slice(0, 1)); // 最初の1行を表示
        } else {
          console.warn("取得したデータが空、または無効です。");
        }
      } else {
        console.warn("API のレスポンスが無効です。");
      }

      setLoading(false); // 読み込み完了
    };

    getData(); // データ取得関数を呼び出し
  }, []);

  /**
   * 配列をシャッフルする関数
   * @param {string[][]} array シャッフル対象の2次元配列
   * @returns {string[][]} シャッフルされた配列
   */
  const shuffleArray = (array: string[][]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // ランダムなインデックスを生成
      [array[i], array[j]] = [array[j], array[i]]; // 要素を交換
    }
    return array;
  };

  /**
   * 絵文字 アニメーションを画面上に落とす関数
   * - 画面上部から下部に向かって絵文字をアニメーションさせる
   */
  const dropDog = () => {
    const id = Date.now(); // 現在時刻をIDとして使用
    const x = Math.random() * (width - 50); // 画面幅内でランダムな位置を設定
    const anim = new Animated.Value(0); // アニメーションの初期値を設定

    setDogs(prev => [...prev, { id, x, anim }]); // 既存の絵文字リストに新しい絵文字を追加

    // 絵文字アニメーションを開始（下方向に移動）
    Animated.timing(anim, {
      toValue: height, // 画面の下まで移動
      duration: 2000, // アニメーションの時間
      useNativeDriver: true,
    }).start(() => {
      // アニメーション終了後、絵文字をリストから削除
      setDogs(prev => prev.filter(dog => dog.id !== id));
    });
  };

  return (
    <View style={styles.container}>
      {/* ロゴ画像 */}
      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      {/* データをスクロールビューで表示 */}
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.innerContainer}>
          {loading ? (
            // ローディング中の表示
            <Text style={styles.cellData}>読み込み中...</Text>
          ) : rows.length > 0 ? (
            // データがある場合
            rows.map((row, index) => (
              <View key={index} style={styles.wordContainer}>
                <Text style={styles.cellDataBold}>{row[0]}</Text> {/* データの1列目 */}
                {row[1] && <Text style={styles.cellData}>{row[1]}</Text>} {/* データの2列目 */}
                {row[2] && (
                  <TouchableOpacity onPress={() => Linking.openURL(row[2])}>
                    <Text style={styles.linkText}>外部リンク</Text> {/* 外部リンクの表示 */}
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            // データがない場合
            <Text style={styles.cellData}>データなし</Text>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.push("/selectSheetScreen")}>
            <Text style={styles.buttonText}>単語を覚える</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/ingOrTo")}>
            <Text style={styles.buttonText}>ing or to</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={dropDog}>
            <Text style={styles.buttonText}>いぬ🐶</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {dogs.map(dog => (
        <Animated.Text
          key={dog.id}
          style={[styles.dog, { left: dog.x, transform: [{ translateY: dog.anim }] }]}
        >
          🐶
        </Animated.Text>
      ))}
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
  innerContainer: {
    width: "100%",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 80,
    marginBottom: 20,
    marginTop: 70,
    alignSelf: "center",
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
    marginBottom: 10,
    textAlign: "left",
    width: "80%",
  },
  cellDataBold: {
    fontSize: 18,
    color: "black",
    fontWeight: "bold",
    marginBottom: 5,
  },
  linkText: {
    fontSize: 18,
    color: "blue",
    textDecorationLine: "underline",
    width: "auto",
    alignSelf: "flex-start",
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
  dog: {
    position: "absolute",
    fontSize: 30,
  },
});
