import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "./ScreenHeader";
import { colors } from "./theme";

type Props = {
  title: string;
  onBack: () => void;
  backLabel: string;
  /** 進み具合。なければ（読み込み中など）、進み具合を出さない */
  progress?: { current: number; total: number; percent: number } | null;
  /** ヘッダー右端の、進み具合のあとに置くもの（編集ボタンなど） */
  headerExtra?: React.ReactNode;
  /** 下のボタン。答えを見る前は reveal、見たあとは next。なければボタンを出さない */
  action?: { kind: "reveal" | "next"; onPress: () => void } | null;
  /** 読み込み中・エラー・単語なしのときの文章（カードの代わりに出す） */
  message?: string | null;
  /** カードの中身 */
  children?: React.ReactNode;
};

/**
 * 出題画面の共通の枠（学習と ing or to）
 * ヘッダー・進み具合の線・白いカード・下のボタン1つ。答えは、下のボタンだけで出す
 */
export function QuizFrame({ title, onBack, backLabel, progress, headerExtra, action, message, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        onBack={onBack}
        backLabel={backLabel}
        right={
          <>
            {!!progress && progress.total > 0 && (
              <Text style={styles.progressLabel}>
                {progress.current} / {progress.total}
              </Text>
            )}
            {headerExtra}
          </>
        }
      />

      <View
        accessibilityRole="progressbar"
        accessibilityLabel="進み具合"
        accessibilityValue={{ min: 0, max: progress?.total ?? 0, now: progress?.current ?? 0 }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress?.percent ?? 0}%` }]} />
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {message ? <Text style={styles.message}>{message}</Text> : <View style={styles.card}>{children}</View>}
      </ScrollView>

      {!!action && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.actionButton, action.kind === "next" && styles.nextButton]}
            onPress={action.onPress}
          >
            <Text style={[styles.actionText, action.kind === "next" && styles.nextText]}>{action.kind === "reveal" ? "答えを見る" : "次へ"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressLabel: { fontSize: 15, fontWeight: "bold", color: colors.secondary, paddingHorizontal: 8 },
  track: { height: 6, backgroundColor: colors.panel },
  fill: { height: 6, backgroundColor: colors.primary },
  main: { flex: 1 },
  mainContent: { flexGrow: 1, padding: 16, paddingTop: 20 },
  card: { flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20, gap: 14 },
  message: { fontSize: 16, color: colors.secondary, textAlign: "center", marginTop: 40 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  actionButton: { minHeight: 60, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  nextButton: { backgroundColor: colors.secondary },
  actionText: { color: colors.onPrimary, fontSize: 19, fontWeight: "bold" },
  nextText: { color: colors.onSecondary },
});
