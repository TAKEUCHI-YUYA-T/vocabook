import { useEffect, useState } from "react";
import { spellingProblemsOnDevice, suggestSpellingOnDevice } from "@/db/posDictionary";

/** 入力が止まってから、綴りを確認するまでの待ち時間（ミリ秒） */
export const SPELLING_DELAY_MS = 700;

/** 綴りミスの疑い。word は辞書にない語、suggestions は近い綴りの候補 */
export type SpellingWarning = { word: string; suggestions: string[] };

type Checker = {
  problems: (term: string) => string[];
  suggest: (word: string) => string[];
};

const onDevice: Checker = { problems: spellingProblemsOnDevice, suggest: suggestSpellingOnDevice };

/**
 * 単語の綴りを確認して、辞書にない語があれば、最初の1語と、近い綴りの候補を返す（端末の中だけで動く）
 * 入力が止まるのを待ってから確認する。登録は止めない（知らせるだけ）
 */
export function useSpellingWarning(term: string, delayMs: number = SPELLING_DELAY_MS, checker: Checker = onDevice): SpellingWarning | null {
  const [warning, setWarning] = useState<SpellingWarning | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const [word] = checker.problems(term);
      setWarning(word ? { word, suggestions: checker.suggest(word) } : null);
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, delayMs]);

  return warning;
}
