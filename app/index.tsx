import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Image, ScrollView, useWindowDimensions } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import type { Tip } from "@/db/types";

type MenuItem = { label: string; icon: React.ComponentProps<typeof Feather>["name"]; href: Href; primary: boolean };

/** ホームの4つの入口。学習（黄緑）と管理（白）で色を分け、大きさはすべて同じにする */
const MENU: MenuItem[] = [
  { label: "単語を覚える", icon: "layers", href: "/study", primary: true },
  { label: "ing or to", icon: "help-circle", href: "/ingOrTo", primary: true },
  { label: "単語帳", icon: "book-open", href: "/words", primary: false },
  { label: "単語を追加", icon: "plus-square", href: "/cards/new", primary: false },
];

/**
 * ホーム画面
 * - ヒント（アプリに同梱）を1件、ランダムに表示する
 * - 学習・ing or to・単語帳・単語の追加への入口を、同じ大きさの横長のボタンで縦に並べる
 * - 右下の足あとのボタンで、画面上にアニメーションを使った絵文字を落とす
 */
export default function Home() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [tip, setTip] = useState<Tip | null>(null);
  const [dogs, setDogs] = useState<{ id: number; x: number; anim: Animated.Value }[]>([]);

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
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 96 }]}>
        <Image source={require("../assets/images/logo.png")} style={styles.logo} accessibilityLabel="vocabook" />

        {/* ヒント */}
        {tip && (
          <View style={styles.tip} accessibilityLabel="今日のヒント">
            <View style={styles.tipHeading}>
              <Ionicons name="bulb-outline" size={16} color={colors.secondary} />
              <Text style={styles.tipHeadingText}>今日のヒント</Text>
            </View>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            {!!tip.body && <Text style={styles.tipBody}>{tip.body}</Text>}
            {!!tip.url && (
              <TouchableOpacity accessibilityRole="link" style={styles.tipLink} onPress={() => Linking.openURL(tip.url)}>
                <Text style={styles.tipLinkText}>記事を開く</Text>
                <Feather name="external-link" size={16} color={colors.link} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.menu}>
          {MENU.map((item) => (
            <TouchableOpacity
              key={item.label}
              accessibilityRole="button"
              style={[styles.menuButton, item.primary ? styles.menuPrimary : styles.menuSecondary]}
              onPress={() => router.push(item.href)}
            >
              <Feather name={item.icon} size={28} color={colors.onPrimary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          ))}
          {__DEV__ && (
            <TouchableOpacity style={styles.devLink} onPress={() => router.push("/dev/sheets-spike")}>
              <Text style={styles.devLinkText}>[開発] シート連携の検証</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="いぬを降らせる"
        style={[styles.dogButton, { bottom: insets.bottom + 24 }]}
        onPress={dropDog}
      >
        <MaterialCommunityIcons name="paw" size={26} color={colors.secondary} />
      </TouchableOpacity>

      {dogs.map((dog) => (
        <Animated.Text key={dog.id} style={[styles.dog, { left: dog.x, transform: [{ translateY: dog.anim }] }]}>
          🐶
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 16 },
  logo: { width: 180, height: 80, alignSelf: "center", resizeMode: "contain", marginBottom: 4 },
  tip: { backgroundColor: colors.panel, borderRadius: 14, padding: 16, gap: 8 },
  tipHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipHeadingText: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  tipTitle: { fontSize: 17, fontWeight: "bold", color: colors.text },
  tipBody: { fontSize: 15, lineHeight: 24, color: colors.text },
  tipLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 44 },
  tipLinkText: { fontSize: 15, color: colors.link, textDecorationLine: "underline" },
  menu: { gap: 12 },
  menuButton: { flexDirection: "row", alignItems: "center", gap: 14, height: 68, paddingLeft: 20, paddingRight: 14, borderRadius: 12, borderWidth: 1 },
  menuPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  menuSecondary: { backgroundColor: colors.surface, borderColor: colors.border },
  menuLabel: { flex: 1, fontSize: 18, fontWeight: "bold", color: colors.onPrimary },
  devLink: { alignSelf: "center", padding: 12 },
  devLinkText: { fontSize: 14, color: colors.secondary, textDecorationLine: "underline" },
  dogButton: {
    position: "absolute",
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dog: { position: "absolute", fontSize: 30, pointerEvents: "none" },
});
