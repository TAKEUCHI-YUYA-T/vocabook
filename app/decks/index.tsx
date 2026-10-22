import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { ValidationError } from "@/db/repository";
import type { DeckSummary } from "@/db/types";

/**
 * 単語帳の一覧画面
 * - 標準の単語帳（読み取り専用）と、自分で作った単語帳を並べる
 * - 新しい単語帳を作れる
 */
export default function DecksScreen() {
  const router = useRouter();
  const repository = useRepository();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    repository
      .listDecks()
      .then((list) => active && setDecks(list))
      .catch(() => active && setError("単語帳を読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository]);

  useFocusEffect(load);

  const handleCreate = async () => {
    try {
      const deck = await repository.createDeck(name);
      setName("");
      setIsCreating(false);
      setError(null);
      router.push({ pathname: "/decks/[id]", params: { id: deck.id } });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "単語帳を作れませんでした");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>単語帳</Text>

      <FlatList
        data={decks}
        keyExtractor={(deck) => deck.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: "/decks/[id]", params: { id: item.id } })}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>
              {item.cardCount}語{item.kind === "preset" ? "・標準（編集するにはコピーしてください）" : ""}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>単語帳がありません</Text>}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        {isCreating ? (
          <>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="単語帳の名前"
              autoFocus
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity style={styles.button} onPress={handleCreate}>
              <Text style={styles.buttonText}>作成</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setIsCreating(false);
                setName("");
                setError(null);
              }}
            >
              <Text style={styles.lightButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.button} onPress={() => setIsCreating(true)}>
            <Text style={styles.buttonText}>＋ 新しい単語帳</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/")}>
          <Text style={styles.lightButtonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef", paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  row: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 14, marginBottom: 8 },
  rowTitle: { fontSize: 18, fontWeight: "bold", color: "black" },
  rowSub: { fontSize: 14, color: "#446158", marginTop: 4 },
  empty: { fontSize: 16, color: "#446158", textAlign: "center", marginTop: 20 },
  error: { color: "#ff5757", fontSize: 16, textAlign: "center", marginBottom: 8, paddingHorizontal: 16 },
  footer: { paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" },
  input: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 12, fontSize: 18, width: "100%", marginBottom: 8, backgroundColor: "white" },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, marginVertical: 5, width: "100%", alignItems: "center" },
  secondaryButton: { backgroundColor: "#446158" },
  backButton: { backgroundColor: "#ff5757" },
  buttonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
  lightButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
