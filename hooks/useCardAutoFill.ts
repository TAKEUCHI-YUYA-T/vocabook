import { useCallback, useEffect, useRef, useState } from "react";
import type { CardFormValue } from "@/components/CardForm";
import { MAX_EXAMPLES } from "@/db/examples";
import { meaningQuery, planAutoWrite, type CardAutoFillState, type TranslationStatus } from "@/db/autofill";
import { draftExampleTranslation, draftMeaning, type TranslateFn } from "@/db/draft";
import { guessPartOfSpeechOnDevice } from "@/db/posDictionary";
import { translateOnDevice } from "@/db/translate";
import type { PartOfSpeech } from "@/db/types";

/** 入力が止まってから、品詞を推定するまでの待ち時間（ミリ秒） */
export const TERM_DELAY_MS = 400;
/** 入力が止まってから、意味を訳すまでの待ち時間（ミリ秒）。打ち終わるのを待って、無駄な翻訳を減らす */
export const MEANING_DELAY_MS = 700;
/** 入力・貼り付けが止まってから、例文を訳すまでの待ち時間（ミリ秒） */
export const EXAMPLE_DELAY_MS = 600;

type Options = {
  /** 最初から入っている単語の品詞・意味も下書きする（他のアプリから登録する画面）。省略すると、入力が変わったときだけ動く */
  guessInitialTerm?: boolean;
  translate?: TranslateFn;
  guess?: (term: string) => PartOfSpeech | null;
  termDelayMs?: number;
  meaningDelayMs?: number;
  exampleDelayMs?: number;
};

const IDLE: TranslationStatus = { state: "idle", message: null };

const exampleText = (value: CardFormValue, index: number): string => value.examples[index]?.text ?? "";
const exampleTranslation = (value: CardFormValue, index: number): string => value.examples[index]?.translation ?? "";
/** index 番目の例文の訳だけを、書き換える */
const withTranslation = (value: CardFormValue, index: number, translation: string): CardFormValue => ({
  ...value,
  examples: value.examples.map((example, i) => (i === index ? { ...example, translation } : example)),
});
const slots = Array.from({ length: MAX_EXAMPLES }, (_, i) => i);

/**
 * 単語の入力欄の自動入力（端末の中だけで動き、通信も費用もかからない）
 * - 単語を入力すると、品詞を推定して、空の品詞欄に入れる
 * - 単語を入力すると、日本語の意味を訳して、空の意味欄に入れる
 * - 英語の例文（最大3つ）を入力・貼り付けると、例文ごとに、日本語に訳して、空の「訳」欄に入れる（下書き。登録するのは、あなたが保存したとき）
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
    meaningDelayMs = MEANING_DELAY_MS,
    exampleDelayMs = EXAMPLE_DELAY_MS,
  } = options;

  const [autoPartOfSpeech, setAutoPartOfSpeech] = useState<PartOfSpeech | null>(null);
  const [autoMeaning, setAutoMeaning] = useState<string | null>(null);
  const [meaningStatus, setMeaningStatus] = useState<TranslationStatus>(IDLE);
  const [autoTranslations, setAutoTranslations] = useState<(string | null)[]>(() => slots.map(() => null));
  const [translationStatuses, setTranslationStatuses] = useState<TranslationStatus[]>(() => slots.map(() => IDLE));

  // タイマーや翻訳の完了は、あとから呼ばれるので、その時点の最新の値を読めるようにしておく
  const latest = useRef({ value, autoPartOfSpeech, autoMeaning, autoTranslations });
  useEffect(() => {
    latest.current = { value, autoPartOfSpeech, autoMeaning, autoTranslations };
  });

  // 開いた時点の単語・例文では動かない。一度でも入力が変わったら、以降は（元の値に戻したときも）動く
  const initialTerm = useRef(value.term);
  const initialExamples = useRef(slots.map((i) => exampleText(value, i)));
  const termTouched = useRef(guessInitialTerm);
  const meaningTouched = useRef(guessInitialTerm);
  const exampleTouched = useRef(slots.map(() => false));

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

  // 意味: 単語の入力が止まったら、英語から日本語に訳して、空の（または自動で入れた）意味欄に入れる
  useEffect(() => {
    if (!meaningTouched.current) {
      if (value.term === initialTerm.current) return;
      meaningTouched.current = true;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const now = latest.current;
      const query = meaningQuery(now.value.term);
      if (!query) {
        // 訳せない単語（空、～を含む表現など）になったら、自動で入れた意味は消す
        const plan = planAutoWrite(now.value.meaning, now.autoMeaning, null, "");
        setMeaningStatus(IDLE);
        if (plan.write) {
          setAutoMeaning(null);
          setValue((prev) => (prev.meaning === now.value.meaning ? { ...prev, meaning: "" } : prev));
        }
        return;
      }

      setMeaningStatus({ state: "loading", message: null });
      const result = await draftMeaning(query, translate);
      if (cancelled) return;

      if (result.status === "failed") {
        console.warn("[autofill] 意味の翻訳に失敗:", result.detail);
        setMeaningStatus({ state: "failed", message: result.reason });
        return;
      }
      setMeaningStatus(IDLE);
      if (result.status !== "ok") return;

      const current = latest.current;
      // 翻訳している間に、単語がさらに変わっていたら、次の翻訳に任せる
      if (meaningQuery(current.value.term) !== query) return;
      const plan = planAutoWrite(current.value.meaning, current.autoMeaning, result.meaning, "");
      if (!plan.write) return;
      setAutoMeaning(plan.value || null);
      setValue((prev) => (meaningQuery(prev.term) === query && prev.meaning === current.value.meaning ? { ...prev, meaning: plan.value } : prev));
    }, meaningDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.term]);

  const setAutoTranslation = (index: number, next: string | null) => setAutoTranslations((prev) => prev.map((auto, i) => (i === index ? next : auto)));
  const setTranslationStatus = (index: number, next: TranslationStatus) => setTranslationStatuses((prev) => prev.map((status, i) => (i === index ? next : status)));

  // 例文の訳: index 番目の例文の入力・貼り付けが止まったら、英語から日本語に訳して、空の（または自動で入れた）訳欄に入れる
  // 呼ぶ回数は、いつも同じ（例文の数だけ）なので、フックとして呼んでよい
  const useExampleDraft = (index: number) => {
    useEffect(() => {
      if (!exampleTouched.current[index]) {
        if (exampleText(value, index) === initialExamples.current[index]) return;
        exampleTouched.current[index] = true;
      }
      let cancelled = false;
      const timer = setTimeout(async () => {
        const example = exampleText(latest.current.value, index).trim();
        if (!example) {
          // 例文を消したら、自動で入れた訳も消す
          const now = latest.current;
          const plan = planAutoWrite(exampleTranslation(now.value, index), now.autoTranslations[index], null, "");
          setTranslationStatus(index, IDLE);
          if (plan.write) {
            setAutoTranslation(index, null);
            setValue((prev) => (exampleTranslation(prev, index) === exampleTranslation(now.value, index) ? withTranslation(prev, index, "") : prev));
          }
          return;
        }

        setTranslationStatus(index, { state: "loading", message: null });
        const result = await draftExampleTranslation(example, translate);
        if (cancelled) return;

        if (result.status === "failed") {
          console.warn("[autofill] 例文の翻訳に失敗:", result.detail);
          setTranslationStatus(index, { state: "failed", message: result.reason });
          return;
        }
        setTranslationStatus(index, IDLE);
        if (result.status !== "ok") return;

        const now = latest.current;
        // 翻訳している間に、例文がさらに変わっていたら、次の翻訳に任せる
        if (exampleText(now.value, index).trim() !== example) return;
        const plan = planAutoWrite(exampleTranslation(now.value, index), now.autoTranslations[index], result.text, "");
        if (!plan.write) return;
        setAutoTranslation(index, plan.value || null);
        setValue((prev) =>
          exampleText(prev, index).trim() === example && exampleTranslation(prev, index) === exampleTranslation(now.value, index) ? withTranslation(prev, index, plan.value) : prev
        );
      }, exampleDelayMs);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exampleText(value, index)]);
  };
  useExampleDraft(0);
  useExampleDraft(1);
  useExampleDraft(2);

  /** 入力欄を空に戻したあと（続けて追加するとき）に、自動入力の記録も消す */
  const reset = useCallback(() => {
    setAutoPartOfSpeech(null);
    setAutoMeaning(null);
    setMeaningStatus(IDLE);
    setAutoTranslations(slots.map(() => null));
    setTranslationStatuses(slots.map(() => IDLE));
  }, []);

  return { autoPartOfSpeech, autoMeaning, meaningStatus, autoTranslations, translationStatuses, reset };
}
