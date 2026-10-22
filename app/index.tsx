import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Dimensions, Image, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import type { Tip } from "@/db/types";

/**
 * ホーム画面
 * - ヒント（標準で同梱）を1件、ランダムに表示する
 * - 学習・単語帳・ing or to への入口を並べる
 * - 画面上にアニメーションを使った 絵文字を表示する
 */
export default function Home() {
  const router = useRouter();
  const repository = useRepository();
  const [tip, setTip] = useState<Tip | null>(null);
  const [dogs, setDogs] = useState<{ id: number; x: number; anim: Animated.Value }[]>([]);

  const { width, height } = Dimensions.get("window");

  /** 画面に戻るたびに、ヒントを選び直す */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      repository
        .randomTip()
        .then((next) => active && setTip(next))
        .catch((error) => console.warn("ヒントを読み込めませんでした", error));
      return () => {
        active = false;
      };
    }, [repository])
  );

  /**
   * 絵文字 アニメーションを画面上に落とす関数
   * - 画面上部から下部に向かって絵文字をアニメーションさせる
   */
  const dropDog = () => {
    const id = Date.now(); // 現在時刻をIDとして使用
    const x = Math.random() * (width - 50); // 画面幅内でランダムな位置を設定
    const anim = new Animated.Value(0); // アニメーションの初期値を設定

    setDogs((prev) => [...prev, { id, x, anim }]); // 既存の絵文字リストに新しい絵文字を追加

    // 絵文字アニメーションを開始（下方向に移動）
    Animated.timing(anim, {
      toValue: height, // 画面の下まで移動
      duration: 2000, // アニメーションの時間
      useNativeDriver: true,
    }).start(() => {
      // アニメーション終了後、絵文字をリストから削除
      setDogs((prev) => prev.filter((dog) => dog.id !== id));
    });
  };

  return (
    <View style={styles.container}>
      {/* ロゴ画像 */}
      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.innerContainer}>
          {/* ヒント */}
          {tip && (
            <View style={styles.wordContainer}>
              <Text style={styles.cellDataBold}>{tip.title}</Text>
              {!!tip.body && <Text style={styles.cellData}>{tip.body}</Text>}
              {!!tip.url && (
                <TouchableOpacity onPress={() => Linking.openURL(tip.url)}>
                  <Text style={styles.linkText}>外部リンク</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.push("/study")}>
            <Text style={styles.buttonText}>単語を覚える</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/decks")}>
            <Text style={styles.buttonText}>単語帳</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/ingOrTo")}>
            <Text style={styles.buttonText}>ing or to</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={dropDog}>
            <Text style={styles.buttonText}>いぬ🐶</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity style={styles.button} onPress={() => router.push("/dev/sheets-spike")}>
              <Text style={styles.buttonText}>[開発] シート連携の検証</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {dogs.map((dog) => (
        <Animated.Text key={dog.id} style={[styles.dog, { left: dog.x, transform: [{ translateY: dog.anim }] }]}>
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
