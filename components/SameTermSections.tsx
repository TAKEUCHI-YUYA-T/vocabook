import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { partOfSpeechLabel, type Card } from "@/db/types";
import { ExampleList } from "./ExampleList";
import { colors } from "./theme";

/** 品詞の札（品詞がない単語には、出さない） */
export function PartOfSpeechChip({ card, wide }: { card: Pick<Card, "partOfSpeech">; wide?: boolean }) {
  if (!card.partOfSpeech) return null;
  return (
    <View style={[styles.chip, wide && styles.chipWide]}>
      <Text style={styles.chipText}>{partOfSpeechLabel(card.partOfSpeech)}</Text>
    </View>
  );
}

/**
 * 「ほかの品詞」の欄（英→日・日→英の答えの面）。同じ綴りの、ほかの品詞の意味を、品詞の札つきで並べる
 * 表示するだけで、押しても何も起きない
 */
export function OtherPartsPanel({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.panel} accessibilityLabel="ほかの品詞">
      <Text style={styles.panelTitle}>ほかの品詞</Text>
      {cards.map((card) => (
        <View key={card.id} style={styles.row}>
          <PartOfSpeechChip card={card} />
          <Text style={styles.panelMeaning}>{card.meaning}</Text>
        </View>
      ))}
    </View>
  );
}

/** 聞き取りの答えの面: 意味を、品詞ごとに並べる（意味のない単語は出さない） */
export function MeaningByPartOfSpeech({ cards }: { cards: Card[] }) {
  const shown = cards.filter((card) => card.meaning.trim() !== "");
  return (
    <View style={styles.meanings}>
      {shown.map((card) => (
        <View key={card.id} style={styles.row}>
          <PartOfSpeechChip card={card} wide />
          <Text style={styles.meaningText}>{card.meaning}</Text>
        </View>
      ))}
    </View>
  );
}

/** 聞き取りの答えの面: 例文を、品詞ごとに並べる（例文のない単語は出さない）。単語が1つだけなら、品詞の札は付けない */
export function ExamplesByPartOfSpeech({ cards }: { cards: Card[] }) {
  const shown = cards.filter((card) => card.examples.some((example) => example.text));
  return (
    <View style={styles.groups}>
      {shown.map((card) => (
        <View key={card.id} style={styles.group}>
          {cards.length > 1 && (
            <View style={styles.groupHeading}>
              <PartOfSpeechChip card={card} wide />
            </View>
          )}
          <ExampleList examples={card.examples} showTranslation />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 10, marginTop: 2, backgroundColor: colors.panel },
  chipWide: { minWidth: 56, alignItems: "center" },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  panel: { backgroundColor: colors.panel, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  panelTitle: { fontSize: 13, fontWeight: "600", color: colors.secondary },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  panelMeaning: { flex: 1, fontSize: 15, lineHeight: 24, color: colors.text },
  meanings: { gap: 10 },
  meaningText: { flex: 1, fontSize: 17, fontWeight: "600", lineHeight: 26, color: colors.text },
  groups: { gap: 14 },
  group: { gap: 6 },
  groupHeading: { flexDirection: "row" },
});
