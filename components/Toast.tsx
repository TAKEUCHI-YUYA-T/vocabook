import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "./GlassSurface";
import { Icon, type IconName } from "./Icon";
import { colors } from "./theme";

/** 結果の表示を出しておく時間（ミリ秒）。「元に戻す」付きは、押す余裕がいるので長め */
export const TOAST_MS = 3000;
export const TOAST_WITH_ACTION_MS = 6000;

export type ToastOptions = {
  message: string;
  icon?: IconName;
  /** 押せるボタン（「元に戻す」など）。押すと、トーストは閉じる */
  action?: { label: string; onPress: () => void };
};

type ToastApi = { show: (options: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

/** どの画面からでも、操作の結果を、画面の下に短く出す */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("ToastProvider の中で使ってください");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const counter = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setCurrent(null);
    });
  }, [opacity]);

  const show = useCallback(
    (options: ToastOptions) => {
      clearTimer();
      counter.current += 1;
      setCurrent({ ...options, id: counter.current });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      AccessibilityInfo.announceForAccessibility(options.action ? `${options.message}。${options.action.label}ボタンがあります` : options.message);
      timer.current = setTimeout(hide, options.action ? TOAST_WITH_ACTION_MS : TOAST_MS);
    },
    [hide, opacity]
  );

  useEffect(() => clearTimer, []);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {!!current && (
        <Animated.View key={current.id} pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 24, opacity }]}>
          <GlassSurface radius={28} style={styles.toast}>
            <View style={styles.row} accessibilityLiveRegion="polite">
              <Icon name={current.icon ?? "circle-check"} size={20} color={colors.primary} />
              <Text style={styles.message}>{current.message}</Text>
              {!!current.action && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.action}
                  onPress={() => {
                    const press = current.action!.onPress;
                    hide();
                    press();
                  }}
                >
                  <Text style={styles.actionText}>{current.action.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassSurface>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  toast: { minHeight: 56, justifyContent: "center", paddingLeft: 18, paddingRight: 6, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  message: { flex: 1, fontSize: 15, lineHeight: 20, color: colors.text },
  action: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "600", color: colors.onPrimarySoft },
});
