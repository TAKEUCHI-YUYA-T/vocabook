import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
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
 * 棒を押すと、その日の数を出す（2つのグラフで、同じ日を選ぶ）
 */
export default function StatsScreen() {
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");

  const [period, setPeriod] = useState(PERIODS[0].days);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [selected, setSelected] = useState(PERIODS[0].days - 1);

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

  return (
    <View style={styles.container}>
      <ScreenHeader title="学習の記録" onBack={goBack} backLabel="ホームに戻る" backText="ホーム" />

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
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>覚えた単語（累計）</Text>
          <Text style={styles.readout}>
            {current ? `${shortDay(current.day)}までに  ` : ""}
            <Text style={styles.readoutValue}>{current?.learned ?? 0}</Text>
            <Text style={styles.readoutUnit}> 語</Text>
          </Text>
          <BarChart data={learnedData} selectedIndex={selected} onSelect={setSelected} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 8, gap: 16 },
  segmented: { flexDirection: "row", gap: 2, padding: 2, borderRadius: 10, backgroundColor: colors.fillStrong },
  segment: { flex: 1, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 15, color: colors.text },
  segmentTextSelected: { fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.secondary },
  readout: { fontSize: 13, color: colors.secondary },
  readoutValue: { fontSize: 34, fontWeight: "bold", color: colors.text },
  readoutUnit: { fontSize: 17, fontWeight: "600", color: colors.secondary },
});
