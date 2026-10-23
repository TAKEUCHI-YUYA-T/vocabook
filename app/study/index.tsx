import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { countsByFlag, countsByPart, countTarget, encodeFlags, type BreakdownRow } from "@/db/studyRange";
import { FLAG_LABELS, PARTS_OF_SPEECH, type CardFlag, type StudyDirection } from "@/db/types";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useGoBack } from "@/hooks/useGoBack";
import { isSpeechAvailable } from "@/lib/speech";

/** 品詞のボタンを、1行に並べる数 */
const COLUMNS = 3;

/** 出題の向きの選択肢 */
const DIRECTIONS: { key: StudyDirection; label: string }[] = [
  { key: "en-ja", label: "英語→日本語" },
  { key: "ja-en", label: "日本語→英語" },
  { key: "listen", label: "聞き取り" },
];

/** フラグのボタン（すべて・未設定・覚えた・要復習）。flag が null のものが「すべて」 */
const FLAG_CELLS: { key: string; label: string; flag: CardFlag | null }[] = [
  { key: "all", label: "すべて", flag: null },
  { key: "none", label: "未設定", flag: "" },
  { key: "learned", label: FLAG_LABELS.learned, flag: "learned" },
  { key: "review", label: FLAG_LABELS.review, flag: "review" },
];

type Cell = { key: string; label: string; count: number; selected: boolean; disabled: boolean };

const chunk = <T,>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
};

/**
 * 学習の範囲を選ぶ画面
 * - 出題の向き（英語→日本語、日本語→英語、聞き取り）
 * - フラグ（すべて・未設定・覚えた・要復習。複数選べる）と、品詞（複数選べる）で絞る
 * - ボタンはすべて同じ大きさ。単語数は2行目に出すので、桁が増えても大きさは変わらない。数は、ほかの条件を反映する
 * - 選んだ条件だけを学習画面に渡し、単語は学習画面が DB から読む
 */
export default function StudySelectScreen() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");
  const { deck } = useDefaultDeck();

  const [direction, setDirection] = useState<StudyDirection>("en-ja");
  const [selectedFlags, setSelectedFlags] = useState<CardFlag[]>([]);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const speechAvailable = isSpeechAvailable();

  /** 品詞とフラグの組み合わせごとの単語数を数える。単語やフラグを変えて戻ってきたときも数え直す */
  useFocusEffect(
    useCallback(() => {
      if (!deck) return;
      let active = true;
      repository.studyBreakdown([deck.id]).then((result) => {
        if (!active) return;
        setRows(result);
        setIsLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [repository, deck])
  );

  const needMeaning = direction === "ja-en";
  const selection = useMemo(() => ({ parts: selectedParts, flags: selectedFlags, needMeaning }), [selectedParts, selectedFlags, needMeaning]);

  const total = useMemo(() => countTarget(rows, { parts: [], flags: [], needMeaning }), [rows, needMeaning]);
  const targetCount = useMemo(() => countTarget(rows, selection), [rows, selection]);
  const partCounts = useMemo(() => countsByPart(rows, selection), [rows, selection]);
  const flagCounts = useMemo(() => countsByFlag(rows, selection), [rows, selection]);
  const canStart = !!deck && targetCount > 0;

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const flagCells: Cell[] = FLAG_CELLS.map((cell) => {
    const count = cell.flag === null ? Object.values(flagCounts).reduce((sum, n) => sum + n, 0) : flagCounts[cell.flag];
    const selected = cell.flag === null ? selectedFlags.length === 0 : selectedFlags.includes(cell.flag);
    return { key: cell.key, label: cell.label, count, selected, disabled: count === 0 && !selected };
  });

  const partCells: Cell[] = [
    { key: "all", label: "すべて", count: Object.values(partCounts).reduce((sum, n) => sum + n, 0), selected: selectedParts.length === 0, disabled: false },
    ...PARTS_OF_SPEECH.map((part) => ({
      key: part.key,
      label: part.label,
      count: partCounts[part.key] ?? 0,
      selected: selectedParts.includes(part.key),
      disabled: (partCounts[part.key] ?? 0) === 0 && !selectedParts.includes(part.key),
    })),
  ];

  const start = () => {
    if (!deck) return;
    router.push({
      pathname: "/study/learn",
      params: { decks: deck.id, parts: selectedParts.join(","), flags: encodeFlags(selectedFlags), dir: direction },
    });
  };

  const renderGrid = (cells: Cell[], columns: number, onPress: (key: string) => void) => (
    <View style={styles.grid}>
      {chunk(cells, columns).map((row) => (
        <View key={row[0].key} style={styles.gridRow}>
          {row.map((cell) => (
            <TouchableOpacity
              key={cell.key}
              accessibilityRole="button"
              accessibilityState={{ selected: cell.selected, disabled: cell.disabled }}
              disabled={cell.disabled}
              style={[styles.cell, cell.selected && styles.cellSelected, cell.disabled && styles.cellDisabled]}
              onPress={() => onPress(cell.key)}
            >
              <Text style={[styles.cellLabel, cell.selected && styles.cellLabelSelected]}>{cell.label}</Text>
              <Text style={[styles.cellCount, cell.selected && styles.cellCountSelected]}>{cell.count}語</Text>
            </TouchableOpacity>
          ))}
          {/* 最後の行が埋まらないときも、ボタンの大きさを変えない */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={styles.cellSpacer} />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="学習の範囲" onBack={goBack} backLabel="ホームに戻る" bordered />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>出題の向き</Text>
        <View style={styles.segmented}>
          {DIRECTIONS.map((item) => {
            const selected = direction === item.key;
            const disabled = item.key === "listen" && !speechAvailable;
            return (
              <TouchableOpacity
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                style={[styles.segment, selected && styles.segmentSelected, disabled && styles.cellDisabled]}
                onPress={() => setDirection(item.key)}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {direction === "ja-en" && <Text style={styles.hint}>意味が入っている単語だけから出題します。</Text>}
        {direction === "listen" && <Text style={styles.hint}>単語の音声を聞いて、意味を思い出します。</Text>}

        {isLoaded && total === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>学習できる単語がありません。先に単語を追加してください。</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.emptyButton} onPress={() => router.push("/cards/new")}>
              <Text style={styles.emptyButtonText}>単語を追加</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, styles.sectionGap]}>フラグ</Text>
            {renderGrid(flagCells, FLAG_CELLS.length, (key) => {
              const cell = FLAG_CELLS.find((c) => c.key === key);
              if (!cell) return;
              if (cell.flag === null) setSelectedFlags([]);
              else setSelectedFlags((prev) => toggle(prev, cell.flag as CardFlag));
            })}

            <Text style={[styles.sectionTitle, styles.sectionGap]}>品詞</Text>
            {renderGrid(partCells, COLUMNS, (key) => (key === "all" ? setSelectedParts([]) : setSelectedParts((prev) => toggle(prev, key))))}
          </>
        )}

        <Text style={styles.hint}>フラグ・品詞は、複数選べます。「すべて」なら、その条件では絞りません。</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <Text style={styles.summary}>{canStart ? `${targetCount}語から出題します` : "この条件に合う単語がありません"}</Text>
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
  sectionGap: { marginTop: 8 },
  segmented: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  segmentSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 14, color: colors.text },
  segmentTextSelected: { fontWeight: "bold", color: colors.onPrimary },
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
  emptyBox: { backgroundColor: colors.panel, borderRadius: 12, padding: 16, gap: 12, marginTop: 8 },
  emptyText: { fontSize: 15, lineHeight: 24, color: colors.text },
  emptyButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  emptyButtonText: { fontSize: 17, fontWeight: "bold", color: colors.onPrimary },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: colors.background },
  summary: { textAlign: "center", fontSize: 15, fontWeight: "500", color: colors.secondary },
  startButton: { minHeight: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  startButtonDisabled: { backgroundColor: "gray" },
  startText: { fontSize: 18, fontWeight: "bold", color: colors.onPrimary },
});
