import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "./theme";

export type BarDatum = {
  key: string;
  /** 横軸の目盛り（表示しない日は空） */
  tick: string;
  value: number;
  /** スクリーンリーダーで読む文（例: 10月23日 12語） */
  accessibilityLabel: string;
};

type Props = {
  data: BarDatum[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** グラフ部分の高さ */
  height?: number;
};

/** 目盛りの上限を、きりのよい数（1・2・5 × 10 の累乗）にする。0 件でも、目盛りが出るよう最低 5 */
export function niceMax(max: number): number {
  if (max <= 5) return 5;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) if (step * power >= max) return step * power;
  return 10 * power;
}

/**
 * 1系列の棒グラフ（日ごとの数など）
 * - 棒は深緑、上端は角丸、すき間 2px。0 の日は、基線だけ
 * - 目盛り線は 0・半分・上限の3本（薄い線）。左に数を出す
 * - 棒の列全体を押せる（棒より広い範囲）。選んだ日は、背景を薄く塗る
 */
export function BarChart({ data, selectedIndex, onSelect, height = 150 }: Props) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];
  return (
    <View style={styles.wrap}>
      <View style={[styles.axis, { height }]}>
        {ticks.map((tick) => (
          <Text key={tick} style={styles.axisLabel}>
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </Text>
        ))}
      </View>
      <View style={styles.plotArea}>
        <View style={[styles.plot, { height }]}>
          {/* 目盛り線（上限・半分・0） */}
          {ticks.map((tick) => (
            <View key={tick} style={[styles.gridLine, { top: height - (tick / max) * height }, tick === 0 && styles.baseLine]} />
          ))}
          <View style={styles.bars}>
            {data.map((d, i) => {
              const barHeight = d.value > 0 ? Math.max(2, (d.value / max) * height) : 0;
              const selected = i === selectedIndex;
              return (
                <TouchableOpacity
                  key={d.key}
                  accessibilityRole="button"
                  accessibilityLabel={d.accessibilityLabel}
                  accessibilityState={{ selected }}
                  style={[styles.column, selected && styles.columnSelected]}
                  onPress={() => onSelect(i)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bar, { height: barHeight }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.ticks}>
          {data.map((d) => (
            <Text key={d.key} style={styles.tick} numberOfLines={1}>
              {d.tick}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 6 },
  axis: { justifyContent: "space-between", alignItems: "flex-end", minWidth: 24, marginTop: -7, paddingBottom: 0 },
  axisLabel: { fontSize: 11, lineHeight: 14, color: colors.secondary },
  plotArea: { flex: 1 },
  plot: { position: "relative" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.border },
  baseLine: { backgroundColor: colors.inputBorder },
  bars: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end" },
  column: { flex: 1, height: "100%", justifyContent: "flex-end", paddingHorizontal: 1, borderRadius: 4 },
  columnSelected: { backgroundColor: colors.panel },
  bar: { backgroundColor: colors.secondary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  ticks: { flexDirection: "row", marginTop: 4 },
  tick: { flex: 1, fontSize: 10, color: colors.secondary, textAlign: "center", overflow: "visible" },
});
