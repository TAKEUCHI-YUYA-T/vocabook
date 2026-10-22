import { useCallback, useEffect, useRef, useState } from "react";
import type { CardFormValue } from "@/components/CardForm";
import { planAutoWrite, type CardAutoFillState, type TranslationStatus } from "@/db/autofill";
import { draftExampleTranslation, type TranslateFn } from "@/db/draft";
import { guessPartOfSpeechOnDevice } from "@/db/posDictionary";
import { translateOnDevice } from "@/db/translate";
import type { PartOfSpeech } from "@/db/types";

/** 入力が止まってから、品詞を推定するまでの待ち時間（ミリ秒） */
export const TERM_DELAY_MS = 400;
/** 入力・貼り付けが止まってから、例文を訳すまでの待ち時間（ミリ秒） */
export const EXAMPLE_DELAY_MS = 600;

type Options = {
  /** 最初から入っている単語の品詞も推定する（他のアプリから登録する画面）。省略すると、入力が変わったときだけ推定する */
  guessInitialTerm?: boolean;
  translate?: TranslateFn;
  guess?: (term: string) => PartOfSpeech | null;
  termDelayMs?: number;
  exampleDelayMs?: number;
};

const IDLE: TranslationStatus = { state: "idle", message: null };

/**
 * 単語の入力欄の自動入力（端末の中だけで動き、通信も費用もかからない）
 * - 単語を入力すると、品詞を推定して、空の品詞欄に入れる
 * - 英語の例文を入力・貼り付けると、日本語に訳して、空の「例文の訳」欄に入れる
 * あなたが入力・選択した値は上書きしない（planAutoWrite の規則）
 * 編集画面で、開いた時点の単語・例文では、自動入力しない（入力が変わったときだけ動く）
 */
export function useCardAutoFill(
  value: CardFormValue,
  setValue: React.Dispatch<React.SetStateAction<CardFormValue>>,
  options: Options = {}
): CardAutoFillState & { reset: () => void } {
  const {
    guessInitialTerm = false,
    translate = translateOnDevice,
    guess = guessPartOfSpeechOnDevice,
    termDelayMs = TERM_DELAY_MS,
    exampleDelayMs = EXAMPLE_DELAY_MS,
  } = options;

  const [autoPartOfSpeech, setAutoPartOfSpeech] = useState<PartOfSpeech | null>(null);
  const [autoTranslation, setAutoTranslation] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>(IDLE);

  // タイマーや翻訳の完了は、あとから呼ばれるので、その時点の最新の値を読めるようにしておく
  const latest = useRef({ value, autoPartOfSpeech, autoTranslation });
  useEffect(() => {
    latest.current = { value, autoPartOfSpeech, autoTranslation };
  });

  // 開いた時点の単語・例文では動かない。一度でも入力が変わったら、以降は（元の値に戻したときも）動く
  const initialTerm = useRef(value.term);
  const initialExample = useRef(value.example);
  const termTouched = useRef(guessInitialTerm);
  const exampleTouched = useRef(false);

  // 品詞: 単語の入力が止まったら、推定して、空の（または自動で入れた）品詞を入れ替える
  useEffect(() => {
    if (!termTouched.current) {
      if (value.term === initialTerm.current) return;
      termTouched.current = true;
    }
    const timer = setTimeout(() => {
      const now = latest.current;
      let candidate: PartOfSpeech | null = null;
      try {
        candidate = guess(now.value.term);
      } catch (error) {
        // 辞書を読み込めなくても、入力はそのまま続けられる（品詞が空のままになるだけ）
        console.warn("[autofill] 品詞を推定できませんでした:", error);
      }
      const plan = planAutoWrite<PartOfSpeech | null>(now.value.partOfSpeech, now.autoPartOfSpeech, candidate, null);
      if (!plan.write) return;
      setAutoPartOfSpeech(plan.value);
      // あなたが、その間に品詞を選び直していたら、書き込まない
      setValue((prev) => (prev.partOfSpeech === now.value.partOfSpeech ? { ...prev, partOfSpeech: plan.value } : prev));
    }, termDelayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.term]);

  // 例文の訳: 例文の入力・貼り付けが止まったら、英語から日本語に訳して、空の（または自動で入れた）訳欄に入れる
  useEffect(() => {
    if (!exampleTouched.current) {
      if (value.example === initialExample.current) return;
      exampleTouched.current = true;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const example = latest.current.value.example.trim();
      if (!example) {
        // 例文を消したら、自動で入れた訳も消す
        const now = latest.current;
        const plan = planAutoWrite(now.value.exampleTranslation, now.autoTranslation, null, "");
        setTranslationStatus(IDLE);
        if (plan.write) {
          setAutoTranslation(null);
          setValue((prev) => (prev.exampleTranslation === now.value.exampleTranslation ? { ...prev, exampleTranslation: "" } : prev));
        }
        return;
      }

      setTranslationStatus({ state: "loading", message: null });
      const result = await draftExampleTranslation(example, translate);
      if (cancelled) return;

      if (result.status === "failed") {
        console.warn("[autofill] 例文の翻訳に失敗:", result.detail);
        setTranslationStatus({ state: "failed", message: result.reason });
        return;
      }
      setTranslationStatus(IDLE);
      if (result.status !== "ok") return;

      const now = latest.current;
      // 翻訳している間に、例文がさらに変わっていたら、次の翻訳に任せる
      if (now.value.example.trim() !== example) return;
      const plan = planAutoWrite(now.value.exampleTranslation, now.autoTranslation, result.text, "");
      if (!plan.write) return;
      setAutoTranslation(plan.value || null);
      setValue((prev) =>
        prev.example.trim() === example && prev.exampleTranslation === now.value.exampleTranslation ? { ...prev, exampleTranslation: plan.value } : prev
      );
    }, exampleDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.example]);

  /** 入力欄を空に戻したあと（続けて追加するとき）に、自動入力の記録も消す */
  const reset = useCallback(() => {
    setAutoPartOfSpeech(null);
    setAutoTranslation(null);
    setTranslationStatus(IDLE);
  }, []);

  return { autoPartOfSpeech, autoTranslation, translationStatus, reset };
}
