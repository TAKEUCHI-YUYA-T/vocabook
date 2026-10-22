import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { PARTS_OF_SPEECH } from "@/db/types";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useGoBack } from "@/hooks/useGoBack";

/** 品詞のボタンを、1行に並べる数 */
const COLUMNS = 3;

type Cell = { key: string; label: string; count: number; selected: boolean; disabled: boolean };

const chunk = <T,>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

/**
 * 学習の範囲を選ぶ画面
 * - 品詞を選ぶ（複数選択可。「すべて」なら全部の品詞から出題する）
 * - ボタンはすべて同じ大きさ。単語数は2行目に出すので、桁が増えても大きさは変わらない
 * - 選んだ条件だけを学習画面に渡し、単語は学習画面が DB から読む
 */
export default function StudySelectScreen() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");
  const { deck } = useDefaultDeck();

  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  /** 品詞ごとの単語数を数える（ボタンに表示する）。単語を追加して戻ってきたときも数え直す */
  useFocusEffect(
    useCallback(() => {
      if (!deck) return;
      let active = true;
      repository.countByPartOfSpeech([deck.id]).then((result) => {
        if (!active) return;
        setCounts(result);
        setIsLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [repository, deck])
  );

  const toggle = (part: string) => setSelectedParts((prev) => (prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]));

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  /** 学習の対象になる単語数 */
  const targetCount = selectedParts.length === 0 ? total : selectedParts.reduce((sum, part) => sum + (counts[part] ?? 0), 0);
  const canStart = !!deck && targetCount > 0;

  const cells: Cell[] = [
    { key: "all", label: "すべて", count: total, selected: selectedParts.length === 0, disabled: total === 0 },
    ...PARTS_OF_SPEECH.map((part) => ({
      key: part.key,
      label: part.label,
      count: counts[part.key] ?? 0,
      selected: selectedParts.includes(part.key),
      disabled: (counts[part.key] ?? 0) === 0,
    })),
  ];

  const start = () => {
    if (!deck) return;
    router.push({ pathname: "/study/learn", params: { decks: deck.id, parts: selectedParts.join(",") } });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="学習の範囲" onBack={goBack} backLabel="ホームに戻る" bordered />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>品詞</Text>

        {isLoaded && total === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>学習できる単語がありません。先に単語を追加してください。</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.emptyButton} onPress={() => router.push("/cards/new")}>
              <Text style={styles.emptyButtonText}>単語を追加</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {chunk(cells, COLUMNS).map((row) => (
              <View key={row[0].key} style={styles.gridRow}>
                {row.map((cell) => (
                  <TouchableOpacity
                    key={cell.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: cell.selected, disabled: cell.disabled }}
                    disabled={cell.disabled}
                    style={[styles.cell, cell.selected && styles.cellSelected, cell.disabled && styles.cellDisabled]}
                    onPress={() => (cell.key === "all" ? setSelectedParts([]) : toggle(cell.key))}
                  >
                    <Text style={[styles.cellLabel, cell.selected && styles.cellLabelSelected]}>{cell.label}</Text>
                    <Text style={[styles.cellCount, cell.selected && styles.cellCountSelected]}>{cell.count}語</Text>
                  </TouchableOpacity>
                ))}
                {/* 最後の行が埋まらないときも、ボタンの大きさを変えない */}
                {Array.from({ length: COLUMNS - row.length }, (_, i) => (
                  <View key={`spacer-${i}`} style={styles.cellSpacer} />
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.hint}>複数選べます。「すべて」なら、全部の品詞から出題します。</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <Text style={styles.summary}>{canStart ? `${targetCount}語から出題します` : "学習できる単語がありません"}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !canStart }}
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          disabled={!canStart}
          onPress={start}
        >
          <Text style={styles.startText}>学習を開始</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: colors.secondary },
  grid: { gap: 8 },
  gridRow: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  cellSpacer: { flex: 1 },
  cellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellDisabled: { opacity: 0.35 },
  cellLabel: { fontSize: 16, fontWeight: "bold", color: colors.text },
  cellLabelSelected: { color: colors.onPrimary },
  cellCount: { fontSize: 13, color: colors.secondary },
  cellCountSelected: { fontWeight: "bold" },
  hint: { fontSize: 14, color: colors.secondary },
  emptyBox: { backgroundColor: colors.panel, borderRadius: 12, padding: 16, gap: 12 },
  emptyText: { fontSize: 15, lineHeight: 24, color: colors.text },
  emptyButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  emptyButtonText: { fontSize: 17, fontWeight: "bold", color: colors.onPrimary },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: colors.background },
  summary: { textAlign: "center", fontSize: 15, fontWeight: "500", color: colors.secondary },
  startButton: { minHeight: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  startButtonDisabled: { backgroundColor: "gray" },
  startText: { fontSize: 18, fontWeight: "bold", color: colors.onPrimary },
});
