import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart, type BarDatum } from "@/components/BarChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { lastDays } from "@/db/day";
import { useGoBack } from "@/hooks/useGoBack";

/** 期間の選択肢（日数） */
const PERIODS = [
  { days: 7, label: "1週間" },
  { days: 30, label: "30日" },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type DailyRow = { day: string; studied: number; learned: number };

/** "2026-10-23" → { month: 10, date: 23, weekday: "金" } */
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { month: m, date: d, weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}

const shortDay = (day: string) => {
  const { month, date, weekday } = parseDay(day);
  return `${month}/${date}（${weekday}）`;
};

/**
 * 学習の記録の画面（グラフ）
 * - 学習した単語: 日ごとに、答えを見た単語の数（同じ日に同じ単語は1回）
 * - 覚えた単語: その日までに「覚えた」にした単語の数（累計）
 * 棒を押すと、その日の数を出す（2つのグラフで、同じ日を選ぶ）。表でも見られる
 */
export default function StatsScreen() {
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");

  const [period, setPeriod] = useState(PERIODS[0].days);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [selected, setSelected] = useState(PERIODS[0].days - 1);
  const [showTable, setShowTable] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      repository
        .dailyStats(lastDays(period))
        .then((next) => {
          if (!active) return;
          setRows(next);
          setSelected(next.length - 1); // 今日を選んでおく
        })
        .catch((error) => console.warn("学習の記録を読み込めませんでした", error));
      return () => {
        active = false;
      };
    }, [repository, period])
  );

  // 横軸の目盛り: 1週間は毎日、30日は1週間ごと（最後は今日）
  const tickEvery = period <= 7 ? 1 : 7;
  const toData = (key: "studied" | "learned", unit: (row: DailyRow) => string): BarDatum[] =>
    rows.map((row, i) => {
      const { month, date } = parseDay(row.day);
      const showTick = (rows.length - 1 - i) % tickEvery === 0;
      return { key: row.day, tick: showTick ? `${month}/${date}` : "", value: row[key], accessibilityLabel: `${month}月${date}日 ${unit(row)}` };
    });
  const studiedData = useMemo(() => toData("studied", (r) => `学習 ${r.studied}語`), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const learnedData = useMemo(() => toData("learned", (r) => `覚えた単語 ${r.learned}語`), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = rows[selected];
  const totalStudied = rows.reduce((sum, row) => sum + row.studied, 0);

  return (
    <View style={styles.container}>
      <ScreenHeader title="学習の記録" onBack={goBack} backLabel="ホームに戻る" bordered />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.segmented}>
          {PERIODS.map((item) => {
            const isSelected = item.days === period;
            return (
              <TouchableOpacity
                key={item.days}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.segment, isSelected && styles.segmentSelected]}
                onPress={() => setPeriod(item.days)}
              >
                <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>学習した単語（日ごと）</Text>
          <Text style={styles.readout}>
            {current ? `${shortDay(current.day)}  ` : ""}
            <Text style={styles.readoutValue}>{current?.studied ?? 0}</Text>
            <Text style={styles.readoutUnit}> 語</Text>
          </Text>
          <BarChart data={studiedData} selectedIndex={selected} onSelect={setSelected} />
          <Text style={styles.caption}>期間の合計 {totalStudied}語（日ごとに数えた合計）</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>覚えた単語（累計）</Text>
          <Text style={styles.readout}>
            {current ? `${shortDay(current.day)}までに  ` : ""}
            <Text style={styles.readoutValue}>{current?.learned ?? 0}</Text>
            <Text style={styles.readoutUnit}> 語</Text>
          </Text>
          <BarChart data={learnedData} selectedIndex={selected} onSelect={setSelected} />
          <Text style={styles.caption}>フラグを「覚えた」にした日で数えます。あとでフラグを外した単語は、数えません。</Text>
        </View>

        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showTable }} style={styles.tableToggle} onPress={() => setShowTable((v) => !v)}>
          <Feather name={showTable ? "chevron-up" : "chevron-down"} size={18} color={colors.secondary} />
          <Text style={styles.tableToggleText}>{showTable ? "表を閉じる" : "表で見る"}</Text>
        </TouchableOpacity>

        {showTable && (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.cell, styles.cellDay, styles.cellHead]}>日付</Text>
              <Text style={[styles.cell, styles.cellNum, styles.cellHead]}>学習</Text>
              <Text style={[styles.cell, styles.cellNum, styles.cellHead]}>覚えた（累計）</Text>
            </View>
            {[...rows].reverse().map((row) => (
              <View key={row.day} style={[styles.tableRow, styles.tableRowBorder]}>
                <Text style={[styles.cell, styles.cellDay]}>{shortDay(row.day)}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{row.studied}</Text>
                <Text style={[styles.cell, styles.cellNum]}>{row.learned}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  segmented: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  segmentSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 15, color: colors.text },
  segmentTextSelected: { fontWeight: "bold", color: colors.onPrimary },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: colors.text },
  readout: { fontSize: 14, color: colors.secondary },
  readoutValue: { fontSize: 26, fontWeight: "bold", color: colors.text },
  readoutUnit: { fontSize: 14, color: colors.secondary },
  caption: { fontSize: 12, lineHeight: 18, color: colors.secondary },
  tableToggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  tableToggleText: { fontSize: 15, fontWeight: "bold", color: colors.secondary },
  table: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" },
  tableRow: { flexDirection: "row" },
  tableHead: { backgroundColor: colors.panel },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  cell: { fontSize: 14, color: colors.text, paddingVertical: 8, paddingHorizontal: 12 },
  cellHead: { fontWeight: "bold" },
  cellDay: { flex: 3 },
  cellNum: { flex: 2, textAlign: "right" },
});
