import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Example } from "@/db/examples";
import { SpeakButton } from "./SpeakButton";
import { colors } from "./theme";

type Props = {
  examples: Example[];
  /** 英文を出す（例文ごとの読み上げボタンつき。押した例文だけを読む） */
  showText?: boolean;
  /** 和訳を出す */
  showTranslation?: boolean;
};

/**
 * 例文を、1つずつ並べる（最大3つ）
 * 例文が複数あるときは、番号を付ける。読み上げは、その例文の英文だけ（番号は読まない）
 */
export function ExampleList({ examples, showText = true, showTranslation = false }: Props) {
  const shown = examples
    .map((example, index) => ({ example, index }))
    .filter(({ example }) => (showText && example.text) || (showTranslation && example.translation));
  const numbered = examples.length > 1;
  return (
    <View style={styles.list}>
      {shown.map(({ example, index }) => (
        <View key={index} style={styles.item}>
          {showText && !!example.text && (
            <View style={styles.row}>
              {numbered && <Text style={styles.number}>{index + 1}</Text>}
              <Text style={styles.text}>{example.text}</Text>
              <SpeakButton text={example.text} label={numbered ? `例文${index + 1}を読み上げる` : "例文を読み上げる"} size={20} />
            </View>
          )}
          {showTranslation && !!example.translation && (
            <View style={styles.row}>
              {numbered && !showText && <Text style={styles.number}>{index + 1}</Text>}
              <Text style={[styles.translation, showText && numbered && styles.translationIndent]}>{example.translation}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  item: { gap: 2 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  number: { width: 20, fontSize: 14, lineHeight: 27, fontWeight: "bold", color: colors.secondary },
  text: { flex: 1, fontSize: 16, lineHeight: 27, color: colors.text },
  translation: { flex: 1, fontSize: 15, lineHeight: 24, color: colors.secondary },
  translationIndent: { marginLeft: 26 },
});
