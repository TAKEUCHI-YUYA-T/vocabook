import { requireOptionalNativeModule } from "expo-modules-core";

type SelectedTextEvent = { text: string };

type SelectedTextModule = {
  /** アプリが選んだ文字で起動されたときの文字。なければ null（取り出すと、同じ文字は二度と返らない） */
  getInitialText(): string | null;
  /** 登録のあと、元のアプリ（選択元）に戻る */
  returnToPreviousApp(): void;
  addListener(eventName: "onSelectedText", listener: (event: SelectedTextEvent) => void): { remove(): void };
};

// Android 以外、またはこのモジュールを含まないビルド（古い開発版など）では null になる
const nativeModule = requireOptionalNativeModule<SelectedTextModule>("SelectedText");

export const isSelectedTextAvailable = nativeModule !== null;

export const getInitialSelectedText = (): string | null => nativeModule?.getInitialText() ?? null;

/** アプリの起動中に、新しい文字が届いたときの通知を受け取る。戻り値で購読を解除する */
export const addSelectedTextListener = (listener: (text: string) => void): (() => void) => {
  if (!nativeModule) return () => {};
  const subscription = nativeModule.addListener("onSelectedText", (event) => listener(event.text));
  return () => subscription.remove();
};

export const returnToPreviousApp = (): void => nativeModule?.returnToPreviousApp();
