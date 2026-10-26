import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useGoBack } from "@/hooks/useGoBack";
import { PRIVACY_POLICY_URL, SUPPORT_URL } from "@/lib/links";
import licenses from "../assets/licenses.json";
import wordnet from "../assets/dictionary/wordnet-license.json";

/**
 * このアプリについての画面
 * - プライバシーポリシーと連絡先へのリンク
 * - 使っている辞書（WordNet）と、ライブラリのライセンス表示（配布の条件として、必ず表示する）
 */
export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");
  const version = Constants.expoConfig?.version ?? "";

  return (
    <View style={styles.container}>
      <ScreenHeader title="このアプリについて" onBack={goBack} bordered />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.block}>
          <Text style={styles.appName}>vocabook</Text>
          <Text style={styles.text}>英単語を覚えるためのアプリです。単語と学習の記録は、この端末の中だけに保存されます。</Text>
          {!!version && <Text style={styles.muted}>バージョン {version}</Text>}
        </View>

        <View style={styles.block}>
          <LinkRow label="プライバシーポリシー" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
          <LinkRow label="不具合の連絡・ソースコード" onPress={() => Linking.openURL(SUPPORT_URL)} />
        </View>

        <View style={styles.block}>
          <Text style={styles.heading}>辞書と翻訳</Text>
          <Text style={styles.text}>
            品詞の自動判定と綴りの確認には、Princeton 大学の WordNet 3.0 の見出し語を使っています。意味と例文の自動翻訳は、Google ML Kit の端末内の翻訳で行い、入力した文を外部に送りません。
          </Text>
          <Text style={styles.subheading}>{wordnet.name} のライセンス</Text>
          <Text style={styles.license} selectable>
            {wordnet.text}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.heading}>オープンソースのライブラリ</Text>
          <Text style={styles.text}>このアプリは、次のライブラリを使っています（各ライブラリの著作権とライセンスの条件に従います）。</Text>
          {licenses.map((item) => (
            <View key={item.name} style={styles.libRow}>
              <Text style={styles.libName}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.version}　{item.license}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={label} style={styles.linkRow} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  block: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10 },
  appName: { fontSize: 24, fontWeight: "bold", color: colors.text },
  heading: { fontSize: 17, fontWeight: "bold", color: colors.text },
  subheading: { fontSize: 14, fontWeight: "bold", color: colors.secondary, marginTop: 4 },
  text: { fontSize: 15, lineHeight: 24, color: colors.text },
  muted: { fontSize: 13, lineHeight: 20, color: colors.secondary },
  license: { fontSize: 12, lineHeight: 18, color: colors.text },
  linkRow: { minHeight: 48, justifyContent: "center" },
  linkText: { fontSize: 16, fontWeight: "bold", color: colors.secondary, textDecorationLine: "underline" },
  libRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  libName: { fontSize: 14, fontWeight: "bold", color: colors.text },
});
