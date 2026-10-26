import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { BackupError, parseBackup } from "@/db/backup";
import { useDb } from "@/db/AppDatabase";
import { useGoBack } from "@/hooks/useGoBack";
import { adsEnabled, privacyOptionsRequired, showPrivacyOptions } from "@/lib/ads";
import { applyRestore, pickBackupFile, shareBackupFile } from "@/lib/backup";
import { CONTACT_URL, PRIVACY_POLICY_URL } from "@/lib/links";

/** 日時を「2026/10/26 18:35」の形にする（端末の時刻） */
const formatDateTime = (date: Date): string => {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${two(date.getMonth() + 1)}/${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
};

/**
 * 設定の画面
 * - アプリの名前・バージョン・更新の日時
 * - バックアップ（毎日の自動保存は、端末の Google のバックアップ。手動の書き出しと、ファイルからの復元）
 * - 広告の説明と、同意の設定（ストア版だけ。同意の設定は、欧州などの利用者だけ）
 * - お問い合わせ・プライバシーポリシー・ライセンス
 */
export default function SettingsScreen() {
  const router = useRouter();
  const db = useDb();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");

  const version = Constants.expoConfig?.version ?? "";
  const updatedAt = Updates.createdAt ? formatDateTime(Updates.createdAt) : null;

  const [busy, setBusy] = useState<"restore" | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    privacyOptionsRequired().then(setShowConsent);
  }, []);

  const share = async () => {
    try {
      await shareBackupFile(db);
    } catch {
      Alert.alert("保存できませんでした", "もう一度、お試しください。");
    }
  };

  const restore = async () => {
    const picked = await pickBackupFile();
    if (!picked.ok) {
      if (!picked.cancelled) Alert.alert("復元できませんでした", picked.message ?? "ファイルを読み込めませんでした");
      return;
    }
    // 置き換える前に、ファイルの中身を確かめる（問題があれば、ここで止める）
    try {
      parseBackup(picked.text);
    } catch (error) {
      Alert.alert("復元できませんでした", error instanceof BackupError ? error.message : "ファイルを読み取れませんでした");
      return;
    }
    Alert.alert("バックアップから復元しますか？", "前回のバックアップ後に変更した内容は失われます。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "OK",
        onPress: async () => {
          setBusy("restore");
          const result = await applyRestore(db, picked.text);
          setBusy(null);
          Alert.alert(result.ok ? "復元しました" : "復元できませんでした", result.ok ? `${result.cards}語を復元しました。` : result.message);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="設定" onBack={goBack} backText="ホーム" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.block}>
          <Text style={styles.appName}>vocabook</Text>
          {!!version && <Text style={styles.muted}>バージョン {version}</Text>}
          <Text style={styles.muted}>{updatedAt ? `更新: ${updatedAt}` : "更新: アプリに含まれる版"}</Text>
        </View>

        <Text style={styles.sectionTitle}>バックアップ</Text>
        <View style={styles.group}>
          <Text style={styles.groupText}>
            端末の Google のバックアップがオンなら、単語や学習の記録は、自動で保存されます（端末の「設定」→「Google」→「バックアップ」）。機種変更のときは、新しい端末の初期設定で、バックアップから復元してください。
          </Text>
          <Row label="バックアップを書き出す" onPress={share} arrow />
          <Row label="バックアップから復元" onPress={restore} disabled={!!busy} busy={busy === "restore"} arrow />
        </View>
        <Text style={styles.footnote}>書き出したファイルは、Google ドライブなど、好きな場所に保存できます。iPhone へ移すときや、手元にも残したいときに使います。学習の記録も含みます。</Text>

        {adsEnabled && (
          <>
            <Text style={styles.sectionTitle}>広告</Text>
            <View style={styles.group}>
              <Text style={styles.groupText}>
                無料で提供するため、Google AdMob の広告を表示します。広告の表示のために、広告 ID や端末の情報が使われることがあります。詳しくは、プライバシーポリシーをご覧ください。
              </Text>
              {showConsent && <Row label="広告のプライバシーの設定" onPress={() => showPrivacyOptions()} />}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>サポート</Text>
        <View style={styles.group}>
          <Row label="お問い合わせ" onPress={() => Linking.openURL(CONTACT_URL)} external first />
          <Row label="プライバシーポリシー" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} external />
          <Row label="ライセンス" onPress={() => router.push("/licenses")} arrow />
        </View>
      </ScrollView>
    </View>
  );
}

type RowProps = {
  label: string;
  value?: string;
  valueWarn?: boolean;
  onPress?: () => void;
  /** 別の画面へ進む行（右に ›） */
  arrow?: boolean;
  /** ブラウザなど、アプリの外を開く行（右に外へのアイコン） */
  external?: boolean;
  first?: boolean;
  disabled?: boolean;
  busy?: boolean;
};

/** iOS の「設定」のような行。左に名前、右に値と矢印。押せない行は、矢印を出さない */
function Row({ label, value, valueWarn, onPress, arrow, external, first, disabled, busy }: RowProps) {
  const pressable = !!onPress && !disabled;
  return (
    <TouchableOpacity
      accessibilityRole={pressable ? (external ? "link" : "button") : "text"}
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityState={{ disabled: !pressable && !!onPress }}
      disabled={!pressable}
      style={[styles.row, !first && styles.rowDivider]}
      onPress={onPress}
    >
      <Text style={[styles.rowLabel, !pressable && !!onPress && styles.rowLabelDisabled, onPress && pressable && !value && styles.rowLabelAction]}>{label}</Text>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {!!value && (
            <Text style={[styles.rowValue, valueWarn && styles.rowValueWarn]} numberOfLines={1}>
              {value}
            </Text>
          )}
          {pressable && (arrow || external) && <Feather name={external ? "external-link" : "chevron-right"} size={18} color={colors.inputBorder} />}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 8, gap: 8 },
  block: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6, marginBottom: 8 },
  appName: { fontSize: 24, fontWeight: "bold", color: colors.text },
  muted: { fontSize: 13, lineHeight: 20, color: colors.secondary },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.secondary, paddingHorizontal: 16, marginTop: 16 },
  group: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  groupText: { fontSize: 15, lineHeight: 24, color: colors.text, padding: 16 },
  footnote: { fontSize: 13, lineHeight: 19, color: colors.secondary, paddingHorizontal: 16 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inputBorder },
  rowLabel: { flex: 1, fontSize: 17, color: colors.text },
  rowLabelAction: { color: colors.primary },
  rowLabelDisabled: { color: colors.inputBorder },
  rowValue: { maxWidth: "55%", fontSize: 15, color: colors.secondary },
  rowValueWarn: { color: colors.warning },
});
