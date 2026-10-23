import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
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
  /** 綴りミスの疑いがあるとき（辞書にない語）。目印を付ける。読み上げは、綴りのとおりに読む */
  warn?: boolean;
};

/** 英語を読み上げる、小さなボタン。読み上げの部品が無い版のアプリでは、何も出さない */
export function SpeakButton({ text, label, size = 22, rate, warn }: Props) {
  if (!text.trim() || !isSpeechAvailable()) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={warn ? `${label}（辞書にない語です。綴りを確認してください。綴りのとおりに読みます）` : label}
      style={styles.button}
      onPress={() => speakEnglish(text, rate)}
      hitSlop={8}
    >
      <Feather name="volume-2" size={size} color={warn ? colors.warningText : colors.secondary} />
      {warn && (
        <View style={styles.badge}>
          <Feather name="alert-circle" size={12} color={colors.warningText} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
});
