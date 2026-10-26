import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { BackupError, parseBackup } from "@/db/backup";
import { useDb } from "@/db/AppDatabase";
import { useGoBack } from "@/hooks/useGoBack";
import { adsEnabled, privacyOptionsRequired, showPrivacyOptions } from "@/lib/ads";
import { applyRestore, chooseBackupFolder, pickBackupFile, readBackupState, runBackup, shareBackupFile, type BackupState } from "@/lib/backup";
import { CONTACT_URL, PRIVACY_POLICY_URL } from "@/lib/links";

/** 日時を「2026/10/26 18:35」の形にする（端末の時刻） */
const formatDateTime = (date: Date): string => {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${two(date.getMonth() + 1)}/${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
};

/**
 * 設定の画面
 * - アプリの名前・バージョン・更新の日時
 * - バックアップ（毎日1回、同じファイルに上書き）と、復元
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

  const [backup, setBackup] = useState<BackupState>({ folderName: null, lastAt: null, lastError: null });
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  const refresh = useCallback(() => {
    readBackupState(db).then(setBackup).catch(() => undefined);
  }, [db]);
  useFocusEffect(refresh);
  useEffect(() => {
    privacyOptionsRequired().then(setShowConsent);
  }, []);

  const chooseFolder = async () => {
    if (await chooseBackupFolder(db)) {
      setBusy("backup");
      const result = await runBackup(db); // 選んだらすぐに、1回作って、書き込めることを確かめる
      setBusy(null);
      refresh();
      if (!result.ok) Alert.alert("バックアップできませんでした", result.message);
    }
  };

  const backupNow = async () => {
    setBusy("backup");
    const result = await runBackup(db);
    setBusy(null);
    refresh();
    Alert.alert(result.ok ? "バックアップしました" : "バックアップできませんでした", result.ok ? `${result.cards}語を保存しました。` : result.message);
  };

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
    let preview;
    try {
      preview = parseBackup(picked.text);
    } catch (error) {
      Alert.alert("復元できませんでした", error instanceof BackupError ? error.message : "ファイルを読み取れませんでした");
      return;
    }
    const when = preview.exportedAt ? `（${formatDateTime(new Date(preview.exportedAt))} のバックアップ）` : "";
    Alert.alert("バックアップから復元しますか？", `${preview.cards.length}語${when}で、今の単語・学習の記録を置き換えます。元には戻せません。`, [
      { text: "やめる", style: "cancel" },
      {
        text: "置き換える",
        style: "destructive",
        onPress: async () => {
          setBusy("restore");
          const result = await applyRestore(db, picked.text);
          setBusy(null);
          if (result.ok) Alert.alert("復元しました", `${result.cards}語を復元しました。`);
          else if ("message" in result) Alert.alert("復元できませんでした", result.message);
        },
      },
    ]);
  };

  const lastText = backup.lastError ?? (backup.lastAt ? formatDateTime(new Date(backup.lastAt)) : "まだありません");

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
          <Row label="保存先のフォルダ" value={backup.folderName ?? "未設定"} onPress={chooseFolder} arrow first />
          <Row label="最後のバックアップ" value={lastText} valueWarn={!!backup.lastError} />
          <Row label="今すぐバックアップ" onPress={backup.folderName ? backupNow : undefined} disabled={!backup.folderName || !!busy} busy={busy === "backup"} />
          <Row label="バックアップから復元" onPress={restore} disabled={!!busy} busy={busy === "restore"} />
        </View>
        <Text style={styles.footnote}>
          保存先のフォルダを選ぶと、アプリを開いたとき、1日に1回、同じファイル（vocabook-backup.json）に上書きします。単語・例文・フラグ・学習の記録のすべてが入ります。機種変更のときは、このファイルを選んで復元します。
        </Text>
        <TouchableOpacity accessibilityRole="button" style={styles.textLink} onPress={share}>
          <Text style={styles.textLinkLabel}>フォルダを使わず、ファイルを共有して保存する</Text>
        </TouchableOpacity>

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
  textLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  textLinkLabel: { fontSize: 15, color: colors.primary },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inputBorder },
  rowLabel: { flex: 1, fontSize: 17, color: colors.text },
  rowLabelAction: { color: colors.primary },
  rowLabelDisabled: { color: colors.inputBorder },
  rowValue: { maxWidth: "55%", fontSize: 15, color: colors.secondary },
  rowValueWarn: { color: colors.warning },
});
