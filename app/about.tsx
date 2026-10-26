import React, { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useGoBack } from "@/hooks/useGoBack";
import { adsEnabled, privacyOptionsRequired, showPrivacyOptions } from "@/lib/ads";
import { PRIVACY_POLICY_URL } from "@/lib/links";

/**
 * このアプリについての画面
 * - アプリの名前・説明・バージョン
 * - 広告の説明と、同意の設定（ストア版だけ。同意の設定は、欧州などの利用者だけ）
 * - プライバシーポリシーと、ライセンス（別の画面）
 */
export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");
  const version = Constants.expoConfig?.version ?? "";
  // 同意が必要な地域（欧州など）の利用者にだけ、同意の設定を出す
  const [showConsent, setShowConsent] = useState(false);
  useEffect(() => {
    privacyOptionsRequired().then(setShowConsent);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader title="このアプリについて" onBack={goBack} backText="ホーム" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.block}>
          <Text style={styles.appName}>vocabook</Text>
          <Text style={styles.text}>英単語を覚えるためのアプリです。単語と学習の記録は、この端末の中だけに保存されます。</Text>
          {!!version && <Text style={styles.muted}>バージョン {version}</Text>}
        </View>

        {adsEnabled && (
          <View style={styles.group}>
            <Text style={[styles.text, styles.groupText]}>
              無料で提供するため、Google AdMob の広告を表示します。広告の表示のために、広告 ID や端末の情報が使われることがあります。詳しくは、プライバシーポリシーをご覧ください。
            </Text>
            {showConsent && <LinkRow label="広告のプライバシーの設定" onPress={() => showPrivacyOptions()} />}
          </View>
        )}

        <View style={styles.group}>
          <LinkRow label="プライバシーポリシー" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} external first />
          <LinkRow label="ライセンス" onPress={() => router.push("/licenses")} />
        </View>
      </ScrollView>
    </View>
  );
}

/** 押すと、ほかの画面やページを開く行（iOS の「設定」のような行。右に矢印） */
function LinkRow({ label, onPress, external, first }: { label: string; onPress: () => void; external?: boolean; first?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole={external ? "link" : "button"} accessibilityLabel={label} style={[styles.linkRow, !first && styles.linkDivider]} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
      <Feather name={external ? "external-link" : "chevron-right"} size={18} color={colors.inputBorder} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 8, gap: 16 },
  block: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  appName: { fontSize: 24, fontWeight: "bold", color: colors.text },
  text: { fontSize: 15, lineHeight: 24, color: colors.text },
  muted: { fontSize: 13, lineHeight: 20, color: colors.secondary },
  group: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  groupText: { padding: 16 },
  linkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 16 },
  linkDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inputBorder },
  linkText: { fontSize: 17, color: colors.text },
});
