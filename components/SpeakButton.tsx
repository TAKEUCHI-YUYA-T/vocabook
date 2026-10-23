import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { isSpeechAvailable, speakEnglish } from "@/lib/speech";
import { colors } from "./theme";

type Props = {
  /** 読み上げる英語（空なら、ボタンを出さない） */
  text: string;
  /** 読み上げの名前（スクリーンリーダー用） */
  label: string;
  /** アイコンの大きさ */
  size?: number;
  /** 読み上げの速さ（省略すると標準） */
  rate?: number;
};

/** 英語を読み上げる、小さなボタン。読み上げの部品が無い版のアプリでは、何も出さない */
export function SpeakButton({ text, label, size = 22, rate }: Props) {
  if (!text.trim() || !isSpeechAvailable()) return null;
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} style={styles.button} onPress={() => speakEnglish(text, rate)} hitSlop={8}>
      <Feather name="volume-2" size={size} color={colors.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
