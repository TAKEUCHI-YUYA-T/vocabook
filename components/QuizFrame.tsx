import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "./ScreenHeader";
import { AdBanner } from "./AdBanner";
import { colors } from "./theme";

type Props = {
  title: string;
  onBack: () => void;
  backLabel: string;
  /** 戻るボタンの横の、戻り先の名前（「ホーム」「範囲」など） */
  backText?: string;
  /** 進み具合。なければ（読み込み中など）、進み具合を出さない */
  progress?: { current: number; total: number; percent: number } | null;
  /** ヘッダー右端の、進み具合のあとに置くもの（編集ボタンなど） */
  headerExtra?: React.ReactNode;
  /** 下のボタン。答えを見る前は reveal、見たあとは next。なければボタンを出さない */
  action?: { kind: "reveal" | "next"; onPress: () => void } | null;
  /** 下の操作を、画面側で作る（指定すると、action の代わりに出す。学習画面の、フラグのボタンなど） */
  footer?: React.ReactNode;
  /** 読み込み中・エラー・単語なしのときの文章（カードの代わりに出す） */
  message?: string | null;
  /** カードの中身 */
  children?: React.ReactNode;
};

/**
 * 出題画面の共通の枠（学習と ing or to。Apple 風）
 * ヘッダー・細い進み具合の線・広告・白い角丸のカード・下の大きなボタン。答えは、下のボタンだけで出す
 */
export function QuizFrame({ title, onBack, backLabel, backText, progress, headerExtra, action, footer, message, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        onBack={onBack}
        backLabel={backLabel}
        backText={backText}
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

      <AdBanner />

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {message ? <Text style={styles.message}>{message}</Text> : <View style={styles.card}>{children}</View>}
      </ScrollView>

      {!!footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>{footer}</View>}

      {!footer && !!action && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <TouchableOpacity accessibilityRole="button" style={styles.actionButton} onPress={action.onPress}>
            <Text style={styles.actionText}>{action.kind === "reveal" ? "答えを見る" : "次へ"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progressLabel: { fontSize: 15, color: colors.secondary, paddingHorizontal: 8, fontVariant: ["tabular-nums"] },
  track: { height: 4, marginHorizontal: 16, borderRadius: 2, backgroundColor: colors.fillStrong, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  main: { flex: 1 },
  mainContent: { flexGrow: 1, padding: 16, paddingTop: 8 },
  card: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  message: { fontSize: 16, color: colors.secondary, textAlign: "center", marginTop: 40 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
  actionButton: { minHeight: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.onPrimary, fontSize: 17, fontWeight: "600" },
});
