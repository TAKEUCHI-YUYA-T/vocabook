import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useRepository } from "@/db/AppDatabase";
import { PARTS_OF_SPEECH, type DeckSummary } from "@/db/types";

/**
 * 学習の条件を選ぶ画面
 * - 単語帳（複数選択可）と、品詞（複数選択可。未選択なら全部）を選ぶ
 * - 選んだ条件の ID だけを学習画面に渡し、単語は学習画面が DB から読む
 */
export default function StudySelectScreen() {
  const router = useRouter();
  const repository = useRepository();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  /** 単語帳の一覧を読み込む。初回は、単語のある単語帳をすべて選んだ状態にする */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      repository.listDecks().then((list) => {
        if (!active) return;
        const studyable = list.filter((deck) => deck.cardCount > 0);
        setDecks(studyable);
        setSelectedDeckIds((prev) => (prev.length > 0 ? prev.filter((id) => studyable.some((d) => d.id === id)) : studyable.map((d) => d.id)));
        setIsLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [repository])
  );

  /** 選んだ単語帳の、品詞ごとの単語数を数える（品詞のボタンに表示する） */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      repository.countByPartOfSpeech(selectedDeckIds).then((result) => active && setCounts(result));
      return () => {
        active = false;
      };
    }, [repository, selectedDeckIds])
  );

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  /** 学習の対象になる単語数 */
  const targetCount =
    selectedParts.length === 0
      ? Object.values(counts).reduce((sum, n) => sum + n, 0)
      : selectedParts.reduce((sum, part) => sum + (counts[part] ?? 0), 0);

  const canStart = selectedDeckIds.length > 0 && targetCount > 0;

  const start = () => {
    router.push({
      pathname: "/study/learn",
      params: { decks: selectedDeckIds.join(","), parts: selectedParts.join(",") },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>学習する範囲を選んでください</Text>

        <Text style={styles.sectionTitle}>単語帳</Text>
        {isLoaded && decks.length === 0 && <Text style={styles.empty}>学習できる単語がありません。先に単語帳に単語を追加してください。</Text>}
        {decks.map((deck) => {
          const selected = selectedDeckIds.includes(deck.id);
          return (
            <TouchableOpacity
              key={deck.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setSelectedDeckIds((prev) => toggle(prev, deck.id))}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {deck.name}（{deck.cardCount}語）
              </Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.sectionTitle}>品詞（選ばなければすべて）</Text>
        <View style={styles.grid}>
          {PARTS_OF_SPEECH.map((part) => {
            const count = counts[part.key] ?? 0;
            const selected = selectedParts.includes(part.key);
            return (
              <TouchableOpacity
                key={part.key}
                disabled={count === 0}
                style={[styles.chip, selected && styles.optionSelected, count === 0 && styles.chipDisabled]}
                onPress={() => setSelectedParts((prev) => toggle(prev, part.key))}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {part.label} {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.summary}>{canStart ? `${targetCount}語で学習します` : "学習できる単語がありません"}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, !canStart && styles.disabledButton]} disabled={!canStart} onPress={start}>
          <Text style={styles.startButtonText}>学習を開始</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/")}>
          <Text style={styles.backButtonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffeef" },
  content: { padding: 16, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#446158", marginTop: 12, marginBottom: 8 },
  empty: { fontSize: 16, color: "#446158", marginBottom: 8 },
  option: { borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 12, marginBottom: 8 },
  optionSelected: { backgroundColor: "#9fd700", borderColor: "#9fd700" },
  optionText: { fontSize: 18, color: "black" },
  optionTextSelected: { color: "white", fontWeight: "bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "gray", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  chipDisabled: { opacity: 0.35 },
  summary: { fontSize: 16, fontWeight: "600", color: "#446158", textAlign: "center", marginTop: 20 },
  footer: { paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, marginVertical: 5, width: "100%", alignItems: "center" },
  disabledButton: { backgroundColor: "gray" },
  backButton: { backgroundColor: "#ff5757" },
  startButtonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
  backButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
