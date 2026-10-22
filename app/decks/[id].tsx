import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import { partOfSpeechLabel, type Card, type Deck } from "@/db/types";

/** 画面に一度に出す単語数。単語が多い単語帳でも軽く表示できるよう、少しずつ表示を増やす */
const PAGE_SIZE = 50;

/**
 * 単語帳の中身の画面
 * - 単語の一覧と検索（単語・意味・例文）
 * - 単語の追加、単語帳の名前の変更、削除
 */
export default function DeckDetailScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mode, setMode] = useState<"view" | "rename" | "confirmDelete">("view");
  const [draftName, setDraftName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    Promise.all([repository.getDeck(id), repository.listCards(id, query)])
      .then(([nextDeck, nextCards]) => {
        if (!active) return;
        setDeck(nextDeck);
        setCards(nextCards);
      })
      .catch(() => active && setMessage("読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository, id, query]);

  useFocusEffect(load);

  // 検索語が変わったら、表示件数を最初に戻す
  useEffect(() => setVisibleCount(PAGE_SIZE), [query]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof ValidationError ? e.message : "処理に失敗しました");
    }
  };

  if (!deck) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{message ?? "読み込み中..."}</Text>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/decks")}>
          <Text style={styles.lightButtonText}>単語帳の一覧に戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>{deck.name}</Text>

      {mode === "rename" && (
        <View style={styles.panel}>
          <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} maxLength={100} autoFocus placeholder="単語帳の名前" />
          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              run(async () => {
                await repository.renameDeck(deck.id, draftName);
                setMode("view");
                setMessage(null);
                load();
              })
            }
          >
            <Text style={styles.buttonText}>名前を変更</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "confirmDelete" && (
        <View style={styles.panel}>
          <Text style={styles.warning}>「{deck.name}」と、中の単語{cards.length}語を削除します。よろしいですか？</Text>
          <TouchableOpacity
            style={[styles.button, styles.backButton]}
            onPress={() =>
              run(async () => {
                await repository.deleteDeck(deck.id);
                router.replace("/decks");
              })
            }
          >
            <Text style={styles.lightButtonText}>削除する</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setMode("view")}>
            <Text style={styles.lightButtonText}>やめる</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="単語・意味・例文を検索" clearButtonMode="while-editing" />

      <FlatList
        data={cards.slice(0, visibleCount)}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.list}
        onEndReached={() => setVisibleCount((n) => n + PAGE_SIZE)}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: "/cards/[id]", params: { id: item.id } })}>
            <Text style={styles.rowTitle}>
              {item.term}
              {!!item.partOfSpeech && <Text style={styles.rowPos}>　{partOfSpeechLabel(item.partOfSpeech)}</Text>}
            </Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {item.meaning || "（意味なし）"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{query ? "見つかりませんでした" : "単語がありません"}</Text>}
        ListHeaderComponent={<Text style={styles.count}>{cards.length}語</Text>}
      />

      {!!message && <Text style={styles.error}>{message}</Text>}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/cards/new", params: { deckId: deck.id } })}>
          <Text style={styles.buttonText}>＋ 単語を追加</Text>
        </TouchableOpacity>
        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.smallButton, styles.secondaryButton]}
            onPress={() => {
              setDraftName(deck.name);
              setMode("rename");
            }}
          >
            <Text style={styles.lightButtonText}>名前を変更</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, styles.dangerOutline]} onPress={() => setMode("confirmDelete")}>
            <Text style={styles.dangerText}>削除</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/decks")}>
          <Text style={styles.lightButtonText}>単語帳の一覧に戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
  search: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 10, fontSize: 16, marginHorizontal: 16, marginBottom: 8, backgroundColor: "white" },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  count: { fontSize: 14, color: "#446158", marginBottom: 6 },
  row: { borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 10 },
  rowTitle: { fontSize: 18, fontWeight: "bold", color: "black" },
  rowPos: { fontSize: 13, fontWeight: "normal", color: "#446158" },
  rowSub: { fontSize: 15, color: "#333", marginTop: 2 },
  empty: { fontSize: 16, color: "#446158", textAlign: "center", marginTop: 20 },
  error: { color: "#ff5757", fontSize: 16, textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
  warning: { fontSize: 16, color: "black", marginBottom: 10 },
  panel: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, backgroundColor: "#f3f0d8" },
  input: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 12, fontSize: 18, marginBottom: 8, backgroundColor: "white" },
  footer: { paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, marginVertical: 5, width: "100%", alignItems: "center" },
  rowButtons: { flexDirection: "row", gap: 8, width: "100%" },
  smallButton: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", marginVertical: 5 },
  secondaryButton: { backgroundColor: "#446158" },
  dangerOutline: { borderWidth: 2, borderColor: "#ff5757" },
  dangerText: { color: "#ff5757", fontSize: 18, fontWeight: "bold" },
  backButton: { backgroundColor: "#ff5757" },
  buttonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
  lightButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
