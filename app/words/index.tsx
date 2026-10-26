import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlagTag } from "@/components/FlagTag";
import { HeaderIconButton, ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { AdBanner } from "@/components/AdBanner";
import { cardsToCsv, exportFileName } from "@/db/importing";
import { ValidationError } from "@/db/repository";
import { ingOrToLabel, partOfSpeechLabel, PARTS_OF_SPEECH, type Card, type Deck } from "@/db/types";
import { useDefaultDeck } from "@/hooks/useDefaultDeck";
import { useGoBack } from "@/hooks/useGoBack";

/** 画面に一度に出す単語数。単語が多くても軽く表示できるよう、少しずつ表示を増やす */
const PAGE_SIZE = 50;

/**
 * 単語帳の画面（単語の一覧）
 * - 単語・意味・例文の検索と、品詞での絞り込み
 * - 右上のメニューから、取り込みと書き出し
 * - 右下のボタンで、単語を追加
 */
export default function WordsScreen() {
  const router = useRouter();
  const repository = useRepository();
  const insets = useSafeAreaInsets();
  const goBack = useGoBack("/");
  const { deck, error: deckError } = useDefaultDeck();

  const [cards, setCards] = useState<Card[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /** 単語と、品詞ごとの数を読み込む。単語を追加・編集して戻ってきたときも読み直す */
  const load = useCallback(() => {
    if (!deck) return;
    let active = true;
    Promise.all([repository.listCards(deck.id, query), repository.countByPartOfSpeech([deck.id])])
      .then(([nextCards, nextCounts]) => {
        if (!active) return;
        setCards(nextCards);
        setCounts(nextCounts);
      })
      .catch(() => active && setMessage("読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository, deck, query]);

  useFocusEffect(load);

  // 検索語や品詞が変わったら、表示件数を最初に戻す
  const changeQuery = (next: string) => {
    setQuery(next);
    setVisibleCount(PAGE_SIZE);
  };
  const changePos = (next: string) => {
    setPos(next);
    setVisibleCount(PAGE_SIZE);
  };

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const filtered = useMemo(() => (pos === "all" ? cards : cards.filter((card) => card.partOfSpeech === pos)), [cards, pos]);
  const chips = [
    { key: "all", label: "すべて", count: total },
    ...PARTS_OF_SPEECH.filter((part) => (counts[part.key] ?? 0) > 0).map((part) => ({ key: part.key, label: part.label, count: counts[part.key] })),
  ];
  const posLabel = pos === "all" ? "" : `${PARTS_OF_SPEECH.find((part) => part.key === pos)?.label ?? ""} `;

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof ValidationError ? e.message : "処理に失敗しました");
    }
  };

  /** 単語帳を CSV にして、共有メニューで他のアプリ（ドライブ、メールなど）に送れるようにする。バックアップ用 */
  const exportCsv = (target: Deck) =>
    run(async () => {
      if (!(await Sharing.isAvailableAsync())) throw new ValidationError("この端末では共有を使えません");
      const all = await repository.listCards(target.id);
      if (all.length === 0) throw new ValidationError("書き出す単語がありません");
      const file = new File(Paths.cache, exportFileName(target.name));
      file.create({ overwrite: true });
      file.write(cardsToCsv(all));
      await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "単語帳を書き出す", UTI: "public.comma-separated-values-text" });
    });

  const menuItems = [
    { label: "取り込み（貼り付け・CSV）", icon: "download" as const, onPress: () => router.push("/words/import") },
    { label: "書き出し（CSV）", icon: "upload" as const, onPress: () => deck && exportCsv(deck) },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="単語帳"
        large
        onBack={goBack}
        backLabel="ホームに戻る"
        backText="ホーム"
        right={<HeaderIconButton icon="more-horizontal" label="その他の操作" onPress={() => setMenuOpen(true)} />}
      />

      <AdBanner />

      <View style={styles.searchBox}>
        <Feather name="search" size={20} color={colors.secondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={changeQuery}
          placeholder="単語・意味・例文を検索"
          accessibilityLabel="単語・意味・例文を検索"
          returnKeyType="search"
        />
      </View>

      {chips.length > 1 && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((chip) => {
              const selected = chip.key === pos;
              return (
                <TouchableOpacity
                  key={chip.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => changePos(chip.key)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {chip.label} {chip.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filtered.slice(0, visibleCount)}
        keyExtractor={(card) => card.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => setVisibleCount((n) => n + PAGE_SIZE)}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: "/cards/[id]", params: { id: item.id } })}>
            <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{item.term}</Text>
              {!!item.partOfSpeech && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{partOfSpeechLabel(item.partOfSpeech)}</Text>
                </View>
              )}
              {!!ingOrToLabel(item.answer) && (
                <View style={[styles.tag, styles.tagInfo]} accessibilityLabel={`ing or to の問題: ${ingOrToLabel(item.answer)}`}>
                  <Text style={[styles.tagText, styles.tagInfoText]}>{ingOrToLabel(item.answer)}</Text>
                </View>
              )}
              <FlagTag flag={item.flag} />
            </View>
            <Text style={styles.rowSub} numberOfLines={1}>
              {item.meaning || "（意味なし）"}
            </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.inputBorder} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{deckError ?? message ?? (query || pos !== "all" ? "見つかりませんでした" : deck ? "単語がありません" : "読み込み中...")}</Text>}
      />

      {!!message && cards.length > 0 && <Text style={styles.error}>{message}</Text>}

      <View style={[styles.toolbar, { paddingBottom: insets.bottom + 6 }]}>
        <View style={styles.toolbarSide} />
        <Text style={styles.count}>
          {posLabel}
          {filtered.length}語
        </Text>
        <View style={[styles.toolbarSide, styles.toolbarRight]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="単語を追加" style={styles.compose} onPress={() => router.push("/cards/new")}>
            <Feather name="edit" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="メニューを閉じる">
          <View style={[styles.menu, { top: insets.top + 52 }]} accessibilityRole="menu">
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                accessibilityRole="menuitem"
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  item.onPress();
                }}
              >
                <Feather name={item.icon} size={20} color={colors.primary} />
                <Text style={styles.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.fillStrong,
  },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { fontWeight: "600", color: colors.onPrimary },
  count: { fontSize: 13, color: colors.secondary },
  list: { flex: 1, marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface },
  listContent: { paddingBottom: 0 },
  row: { minHeight: 56, paddingVertical: 10, paddingLeft: 16, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inputBorder },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 15, color: colors.secondary },
  tag: { borderRadius: 999, paddingVertical: 1, paddingHorizontal: 8, backgroundColor: colors.panel },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  tagInfo: { backgroundColor: colors.infoSoft },
  tagInfoText: { color: colors.info },
  empty: { fontSize: 16, color: colors.secondary, textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
  error: { color: colors.danger, fontSize: 15, textAlign: "center", paddingVertical: 8, paddingHorizontal: 16 },
  toolbar: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6, backgroundColor: "#F9F9F9", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inputBorder },
  toolbarSide: { flex: 1 },
  toolbarRight: { alignItems: "flex-end" },
  compose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.15)" },
  menu: {
    position: "absolute",
    right: 10,
    width: 250,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 16 },
  menuText: { fontSize: 17, color: colors.text },
});
