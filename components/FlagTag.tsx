import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { flagLabel } from "@/db/types";
import { colors } from "./theme";

/** 学習のフラグの札（カプセル形）。「覚えた」は薄い緑、「要復習」は薄いオレンジ。未設定なら何も出さない */
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
  tag: { borderRadius: 999, paddingVertical: 1, paddingHorizontal: 8 },
  learned: { backgroundColor: colors.primarySoft },
  review: { backgroundColor: colors.warningSoft },
  text: { fontSize: 12, fontWeight: "600" },
  learnedText: { color: colors.onPrimarySoft },
  reviewText: { color: colors.warning },
});
