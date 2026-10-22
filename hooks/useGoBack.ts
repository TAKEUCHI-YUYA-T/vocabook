import { useCallback } from "react";
import { useRouter, type Href } from "expo-router";

/** 1つ前の画面に戻る。戻る先がなければ（通知やほかのアプリから直接開いたときなど）、fallback の画面へ */
export function useGoBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
