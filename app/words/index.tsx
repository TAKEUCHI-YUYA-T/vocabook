import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Modal, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlagTag } from "@/components/FlagTag";
import { HeaderIconButton, ScreenHeader } from "@/components/ScreenHeader";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import presetDefaultWords from "../../assets/presets/default-words.json";
import { defaultWordToInput, findMissingDefaultWords } from "@/db/defaultWords";
import { cardsToCsv, exportFileName } from "@/db/importing";
import type { DefaultWord } from "@/db/presets";
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

  /**
   * 既定の単語のうち、単語帳にまだない単語を追加する
   * 同じ単語・同じ品詞が、すでにあれば追加しない。追加する数を確かめてから入れる
   */
  const addDefaultWords = (target: Deck) =>
    run(async () => {
      const existing = await repository.listCards(target.id);
      const missing = findMissingDefaultWords(existing, presetDefaultWords as DefaultWord[]);
      if (missing.length === 0) {
        Alert.alert("既定の単語", "追加できる単語はありません。既定の単語は、すべて単語帳に入っています。");
        return;
      }
      Alert.alert("既定の単語を追加", `${missing.length}語を追加します。同じ単語・同じ品詞がすでにある単語は、追加しません。`, [
        { text: "やめる", style: "cancel" },
        {
          text: "追加する",
          onPress: () =>
            void run(async () => {
              const count = await repository.importCards(target.id, missing.map(defaultWordToInput));
              setMessage(null);
              load();
              Alert.alert("追加しました", `${count}語を追加しました。`);
            }),
        },
      ]);
    });

  const menuItems = [
    { label: "取り込み（貼り付け・CSV）", icon: "download" as const, onPress: () => router.push("/words/import") },
    { label: "書き出し（CSV）", icon: "upload" as const, onPress: () => deck && exportCsv(deck) },
    { label: "既定の単語を追加", icon: "plus-circle" as const, onPress: () => deck && addDefaultWords(deck) },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="単語帳"
        subtitle={deck ? `${total}語` : undefined}
        onBack={goBack}
        backLabel="ホームに戻る"
        right={<HeaderIconButton icon="more-vertical" label="その他の操作" onPress={() => setMenuOpen(true)} />}
      />

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

      <Text style={styles.count}>
        {posLabel}
        {filtered.length}語
      </Text>

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
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{item.term}</Text>
              {!!item.partOfSpeech && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{partOfSpeechLabel(item.partOfSpeech)}</Text>
                </View>
              )}
              {!!ingOrToLabel(item.answer) && (
                <View style={styles.tag} accessibilityLabel={`ing or to の問題: ${ingOrToLabel(item.answer)}`}>
                  <Text style={styles.tagText}>{ingOrToLabel(item.answer)}</Text>
                </View>
              )}
              <FlagTag flag={item.flag} />
            </View>
            <Text style={styles.rowSub} numberOfLines={1}>
              {item.meaning || "（意味なし）"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {deckError ??
              message ??
              (query || pos !== "all"
                ? "見つかりませんでした"
                : deck
                  ? "単語がありません。「単語を追加」のほか、右上の「⋮」→「既定の単語を追加」で、TOEIC 対策の単語を入れられます。"
                  : "読み込み中...")}
          </Text>
        }
      />

      {!!message && cards.length > 0 && <Text style={styles.error}>{message}</Text>}

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.fab, { bottom: insets.bottom + 28 }]}
        onPress={() => router.push("/cards/new")}
      >
        <Feather name="plus" size={22} color={colors.onPrimary} />
        <Text style={styles.fabText}>単語を追加</Text>
      </TouchableOpacity>

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
                <Feather name={item.icon} size={20} color={colors.secondary} />
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
    gap: 8,
    height: 48,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { fontWeight: "bold", color: colors.onPrimary },
  count: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 13, fontWeight: "bold", color: colors.secondary },
  list: { flex: 1, borderTopWidth: 1, borderTopColor: colors.border },
  listContent: { paddingBottom: 96 },
  row: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flexShrink: 1, fontSize: 17, fontWeight: "bold", color: colors.text },
  rowSub: { fontSize: 15, color: colors.text },
  tag: { borderWidth: 1, borderColor: colors.secondary, borderRadius: 6, paddingVertical: 1, paddingHorizontal: 6 },
  tagText: { fontSize: 12, fontWeight: "bold", color: colors.secondary },
  empty: { fontSize: 16, color: colors.secondary, textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
  error: { color: colors.danger, fontSize: 15, textAlign: "center", paddingVertical: 8, paddingHorizontal: 16 },
  fab: {
    position: "absolute",
    right: 16,
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 28,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: colors.secondary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 17, fontWeight: "bold", color: colors.onPrimary },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.15)" },
  menu: {
    position: "absolute",
    right: 10,
    width: 250,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    elevation: 8,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 16 },
  menuText: { fontSize: 16, color: colors.text },
});
