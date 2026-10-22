import { useEffect } from "react";
import { useRootNavigationState, useRouter } from "expo-router";
import { addSelectedTextListener, getInitialSelectedText } from "../modules/selected-text";

/**
 * 他のアプリで選んだ文字（共有・選択メニュー）が届いたら、「単語を登録」画面を開く
 * - アプリが選んだ文字で起動されたとき: 画面の準備ができてから、1度だけ開く
 * - アプリの起動中に届いたとき: すぐに開く
 */
export function SelectedTextRouter() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isReady = !!navigationState?.key;

  const open = (text: string) => router.push({ pathname: "/cards/capture", params: { text } });

  // 起動時に届いている文字（取り出すと、ネイティブ側で消えるので、二重には開かない）
  useEffect(() => {
    if (!isReady) return;
    const initial = getInitialSelectedText();
    if (initial) open(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // 起動中に届く文字
  useEffect(() => {
    if (!isReady) return;
    return addSelectedTextListener(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return null;
}
