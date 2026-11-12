import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

/**
 * 全画面の広告の前に、1 秒ほど出す、「Please wait...」の表示（突然、広告が出ないようにする。Google も、この形を勧めている）
 * 画面全体を覆って、下の操作を受け付けない
 */
export function WaitOverlay() {
  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite" accessibilityLabel="Please wait...">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>Please wait...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill as object,
    zIndex: 100,
    elevation: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "rgba(242,242,247,0.94)",
  },
  text: { fontSize: 17, fontWeight: "600", color: colors.text },
});
