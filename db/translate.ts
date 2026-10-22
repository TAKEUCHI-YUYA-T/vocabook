import type { TranslateFn } from "./draft";

/**
 * 端末内の翻訳（expo-translate-text）を、アプリ共通の形（TranslateFn）で呼ぶ
 *
 * 翻訳の部品は、省略した設定を undefined のままネイティブ（Kotlin）に渡す
 * Kotlin 側は、undefined を受け取れず、"Value is undefined, expected an Object" で失敗する
 * そのため、すべての項目に、値を入れて渡す
 */
export type NativeTranslateParams = {
  input: string;
  sourceLangCode: string;
  targetLangCode: string;
  requiresWifi: boolean;
  requireCharging: boolean;
  preferredStrategy: "lowLatency" | "highFidelity";
};

/** TranslateFn の引数から、undefined を含まない、ネイティブ用の設定を作る */
export function buildNativeParams(params: Parameters<TranslateFn>[0]): NativeTranslateParams {
  return {
    input: params.input,
    sourceLangCode: params.sourceLangCode,
    targetLangCode: params.targetLangCode,
    requiresWifi: params.requiresWifi ?? false,
    requireCharging: false,
    preferredStrategy: "lowLatency",
  };
}

/**
 * 翻訳の部品は、使うときに初めて読み込む
 * 部品（ネイティブ）が含まれていない版のアプリでは、読み込んだ時点でエラーになり、
 * 起動時にアプリ全体が落ちてしまうため（失敗は、呼び出し側が理由つきで受け取る）
 */
export const translateOnDevice: TranslateFn = async (params) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { onTranslateTask } = require("expo-translate-text") as typeof import("expo-translate-text");
  return onTranslateTask(buildNativeParams(params));
};
