import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, ScrollView, useWindowDimensions } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdBanner } from "@/components/AdBanner";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { localDay } from "@/db/day";
import type { HomeStats, Tip } from "@/db/types";

type MenuItem = { label: string; icon: React.ComponentProps<typeof Feather>["name"]; href: Href; color: string; count?: "total" };

/** 「単語を覚える」の下の、3つの入口。iOS の「設定」のように、色つきの小さなアイコンと、右の矢印 */
const MENU: MenuItem[] = [
  { label: "ing or to", icon: "help-circle", href: "/ingOrTo", color: colors.warning },
  { label: "単語帳", icon: "book-open", href: "/words", color: colors.info, count: "total" },
  { label: "単語を追加", icon: "plus", href: "/cards/new", color: colors.purple },
];

/**
 * ホーム画面（Apple 風）
 * - 上: ロゴと、「このアプリについて」のボタン
 * - 今日の学習・覚えた単語の数（押すとグラフ）、今日のヒント（アプリに同梱。ランダムに1件）
 * - 「単語を覚える」の大きなボタンと、ing or to・単語帳・単語を追加の入口
 * - 右下の足あとのボタンで、画面上にアニメーションを使った絵文字を落とす
 */
export default function Home() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [tip, setTip] = useState<Tip | null>(null);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [dogs, setDogs] = useState<{ id: number; x: number; anim: Animated.Value }[]>([]);

  /** 画面に戻るたびに、ヒントを選び直し、今日の学習の記録を読み直す */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      repository
        .randomTip()
        .then((next) => active && setTip(next))
        .catch((error) => console.warn("ヒントを読み込めませんでした", error));
      repository
        .homeStats(localDay())
        .then((next) => active && setStats(next))
        .catch((error) => console.warn("学習の記録を読み込めませんでした", error));
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
      <View style={{ paddingTop: insets.top }}>
        <AdBanner />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.topRow}>
          <Image source={require("../assets/images/logo.png")} style={styles.logo} accessibilityLabel="vocabook" />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="このアプリについて" style={styles.aboutButton} onPress={() => router.push("/about")}>
            <Feather name="info" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* 今日の学習の記録 */}
        {stats && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`学習の記録。今日の学習 ${stats.studiedToday}語、覚えた ${stats.learned}語。押すとグラフを開きます`}
            style={styles.stats}
            onPress={() => router.push("/stats")}
          >
            <View style={styles.stat}>
              <View style={styles.statHeading}>
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={styles.statLabel}>今日の学習</Text>
              </View>
              <Text style={styles.statValue}>
                {stats.studiedToday}
                <Text style={styles.statUnit}> 語</Text>
              </Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statHeading}>
                <Feather name="check-circle" size={16} color={colors.primary} />
                <Text style={styles.statLabel}>覚えた</Text>
              </View>
              <Text style={styles.statValue}>
                {stats.learned}
                <Text style={styles.statUnit}> / {stats.total}語</Text>
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ヒント */}
        {tip && (
          <View style={styles.tip} accessibilityLabel="今日のヒント">
            <View style={styles.tipHeading}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb-outline" size={16} color={colors.warning} />
              </View>
              <Text style={styles.tipHeadingText}>今日のヒント</Text>
            </View>
            {!!tip.title && <Text style={styles.tipTitle}>{tip.title}</Text>}
            {!!tip.body && <Text style={styles.tipBody}>{tip.body}</Text>}
          </View>
        )}

        <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => router.push("/study")}>
          <Feather name="layers" size={20} color={colors.onPrimary} />
          <Text style={styles.primaryLabel}>単語を覚える</Text>
        </TouchableOpacity>

        <View style={styles.menu}>
          {MENU.map((item, index) => (
            <TouchableOpacity key={item.label} accessibilityRole="button" style={styles.menuRow} onPress={() => router.push(item.href)}>
              <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
                <Feather name={item.icon} size={18} color="white" />
              </View>
              <View style={[styles.menuBody, index < MENU.length - 1 && styles.menuDivider]}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.count === "total" && !!stats && <Text style={styles.menuCount}>{stats.total}</Text>}
                <Feather name="chevron-right" size={20} color={colors.inputBorder} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="いぬを降らせる"
        style={[styles.dogButton, { bottom: insets.bottom + 24 }]}
        onPress={dropDog}
      >
        <MaterialCommunityIcons name="paw" size={24} color={colors.secondary} />
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
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 135, height: 60, resizeMode: "contain" },
  aboutButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fillStrong, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  statHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: { fontSize: 13, fontWeight: "600", color: colors.primary },
  statValue: { fontSize: 34, fontWeight: "bold", lineHeight: 40, color: colors.text },
  statUnit: { fontSize: 15, fontWeight: "600", color: colors.secondary },
  tip: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  tipHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center" },
  tipHeadingText: { fontSize: 13, fontWeight: "600", color: colors.secondary },
  tipTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  tipBody: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  primaryButton: { minHeight: 56, borderRadius: 28, backgroundColor: colors.primary, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontSize: 17, fontWeight: "600", color: colors.onPrimary },
  menu: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  menuRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16 },
  menuIcon: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  menuBody: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 },
  menuDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder },
  menuLabel: { flex: 1, fontSize: 17, color: colors.text },
  menuCount: { fontSize: 17, color: colors.secondary },
  dogButton: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dog: { position: "absolute", fontSize: 30, pointerEvents: "none" },
});
