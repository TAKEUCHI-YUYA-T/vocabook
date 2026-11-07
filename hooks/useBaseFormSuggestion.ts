import { useEffect, useState } from "react";
import type { BaseFormSuggestion } from "@/db/lemma";
import { suggestBaseFormsOnDevice } from "@/db/posDictionary";

/** 入力が止まってから、原形の候補を調べるまでの待ち時間（ミリ秒）。入力の途中（used と打つ途中の use など）では出さない */
export const BASE_FORM_DELAY_MS = 700;

type Suggester = (term: string) => BaseFormSuggestion[];

/**
 * 単語が過去形・過去分詞・複数形・-ing 形・三単現のとき、原形の候補を返す（端末の中だけで動く）
 * 自動では直さない。候補のボタンを押したときだけ、画面側で単語を原形に置き換える
 */
export function useBaseFormSuggestion(term: string, delayMs: number = BASE_FORM_DELAY_MS, suggest: Suggester = suggestBaseFormsOnDevice): BaseFormSuggestion[] {
  const [suggestions, setSuggestions] = useState<BaseFormSuggestion[]>([]);

  useEffect(() => {
    // 入力が変わったら、前の候補はすぐ消す（原形に直した直後に、古い候補が残らないように）
    setSuggestions((previous) => (previous.length > 0 ? [] : previous));
    const timer = setTimeout(() => setSuggestions(suggest(term)), delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, delayMs]);

  return suggestions;
}
