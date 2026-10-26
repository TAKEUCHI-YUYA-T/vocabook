import React, { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useGoBack } from "@/hooks/useGoBack";
import licenses from "../assets/licenses.json";
import wordnet from "../assets/dictionary/wordnet-license.json";

type License = { name: string; version: string; license: string; text: string; textFrom?: string };

/** ライセンスの本文の出どころの説明（パッケージに、ライセンスのファイルがなかったとき） */
const sourceNote = (item: License): string | null => {
  if (!item.textFrom) return null;
  if (item.textFrom === "package.json") return "パッケージにライセンスのファイルがないため、package.json の記載に基づく標準の文面です。";
  return `パッケージにライセンスのファイルがないため、同じリポジトリの「${item.textFrom}」のライセンスの文面です。`;
};

/**
 * ライセンスの画面
 * - 辞書（WordNet 3.0）と翻訳（Google ML Kit）の表記
 * - アプリに入っているライブラリと、ライセンスの本文（scripts/build-licenses.js で作る assets/licenses.json）
 * 行を押すと、本文を開く・閉じる
 */
export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/about");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const list = licenses as License[];

  const row = (key: string, title: string, detail: string, body: React.ReactNode, isLast: boolean) => {
    const expanded = open.has(key);
    return (
      <View style={[styles.row, !isLast && styles.rowDivider]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}のライセンス`}
          style={styles.rowHead}
          onPress={() => toggle(key)}
        >
          <View style={styles.rowTitleBox}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowDetail}>{detail}</Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.inputBorder} />
        </TouchableOpacity>
        {expanded && <View style={styles.rowBody}>{body}</View>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="ライセンス" onBack={goBack} backLabel="戻る" backText="戻る" />
      <FlatList
        data={list}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.sectionTitle}>辞書と翻訳</Text>
            <View style={styles.group}>
              <Text style={styles.note}>
                品詞の自動判定と綴りの確認には、Princeton 大学の WordNet 3.0 の見出し語を使っています。意味と例文の自動翻訳には、Google ML Kit の端末内の翻訳を使っています。
              </Text>
              <View style={styles.groupDivider} />
              {row(
                "wordnet",
                wordnet.name,
                "Princeton University",
                <Text style={styles.licenseText} selectable>
                  {wordnet.text}
                </Text>,
                true
              )}
            </View>
            <Text style={[styles.sectionTitle, styles.sectionGap]}>オープンソースのライブラリ（{list.length}件）</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const note = sourceNote(item);
          return (
            <View style={[styles.listItem, index === 0 && styles.listFirst, index === list.length - 1 && styles.listLast]}>
              {row(
                `${item.name}@${item.version}`,
                item.name,
                `${item.version}・${item.license}`,
                <>
                  {!!note && <Text style={styles.sourceNote}>{note}</Text>}
                  <Text style={styles.licenseText} selectable>
                    {item.text}
                  </Text>
                </>,
                index === list.length - 1
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 8 },
  header: { gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.secondary, paddingHorizontal: 16 },
  sectionGap: { marginTop: 16 },
  group: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.inputBorder, marginLeft: 16 },
  note: { fontSize: 15, lineHeight: 22, color: colors.text, padding: 16 },
  listItem: { backgroundColor: colors.surface },
  listFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  listLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  row: { paddingLeft: 16 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder },
  rowHead: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12, paddingVertical: 8 },
  rowTitleBox: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: colors.text },
  rowDetail: { fontSize: 13, color: colors.secondary },
  rowBody: { paddingRight: 16, paddingBottom: 14, gap: 8 },
  sourceNote: { fontSize: 13, lineHeight: 19, color: colors.secondary },
  licenseText: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
});
