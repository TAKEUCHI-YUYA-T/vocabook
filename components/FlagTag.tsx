import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { flagLabel } from "@/db/types";
import { colors } from "./theme";

/** 学習のフラグの札。「覚えた」は黄緑、「要復習」は赤。未設定なら何も出さない */
export function FlagTag({ flag }: { flag: string | null | undefined }) {
  const label = flagLabel(flag);
  if (!label) return null;
  const isReview = flag === "review";
  return (
    <View style={[styles.tag, isReview ? styles.review : styles.learned]} accessibilityLabel={`フラグ: ${label}`}>
      <Text style={[styles.text, isReview ? styles.reviewText : styles.learnedText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: 6, paddingVertical: 1, paddingHorizontal: 7 },
  learned: { backgroundColor: colors.primary },
  review: { backgroundColor: colors.danger },
  text: { fontSize: 12, fontWeight: "bold" },
  learnedText: { color: colors.onPrimary },
  reviewText: { color: colors.surface },
});
