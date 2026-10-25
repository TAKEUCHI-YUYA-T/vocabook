import { useCallback, useEffect, useRef, useState } from "react";
import type { CardFormValue } from "@/components/CardForm";
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
/** index 番目の例文の、自動翻訳の下書き（なければ null）。訳が、この値のままなら、あなたが直していない下書き */
const exampleDraft = (value: CardFormValue, index: number): string | null => value.examples[index]?.draft ?? null;
/**
 * index 番目の例文の訳に、自動翻訳の下書きを書く（空にするときは、下書きの記録も消す）
 * 下書きの記録は、例文と一緒に持つので、例文を削除して並びが変わっても、ずれない
 */
const withDraft = (value: CardFormValue, index: number, translation: string): CardFormValue => ({
  ...value,
  examples: value.examples.map((example, i) => (i === index ? { ...example, translation, draft: translation || undefined } : example)),
});

/**
 * 単語の入力欄の自動入力（端末の中だけで動き、通信も費用もかからない）
 * - 単語を入力すると、品詞を推定して、空の品詞欄に入れる
 * - 単語を入力すると、日本語の意味を訳して、空の意味欄に入れる
 * - 英語の例文（20個まで。1つずつ）を入力・貼り付けると、例文ごとに、日本語に訳して、空の「訳」欄に入れる（下書き。登録するのは、あなたが保存したとき）
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
  /** 例文ごとの、訳を作っている状態（番号は、例文の並び。足りない分は、何もしていない） */
  const [translationStatuses, setTranslationStatuses] = useState<TranslationStatus[]>([]);

  // タイマーや翻訳の完了は、あとから呼ばれるので、その時点の最新の値を読めるようにしておく
  const latest = useRef({ value, autoPartOfSpeech, autoMeaning });
  useEffect(() => {
    latest.current = { value, autoPartOfSpeech, autoMeaning };
  });

  // 開いた時点の単語・例文では動かない。一度でも入力が変わったら、以降は（元の値に戻したときも）動く
  const initialTerm = useRef(value.term);
  const termTouched = useRef(guessInitialTerm);
  const meaningTouched = useRef(guessInitialTerm);
  /** 前回の、例文ごとの英文（変わった例文だけを訳す）。開いた時点の英文から始めるので、開いただけでは訳さない */
  const previousTexts = useRef(value.examples.map((example) => example.text));
  /** 例文ごとの、訳の待ち時間のタイマーと、いま有効な翻訳の番号（古い翻訳の結果を捨てるため） */
  const exampleTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const exampleRuns = useRef(new Map<number, number>());

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

  const setStatus = (index: number, next: TranslationStatus) =>
    setTranslationStatuses((prev) => {
      const copy = prev.slice();
      while (copy.length <= index) copy.push(IDLE);
      copy[index] = next;
      return copy;
    });

  /** index 番目の例文を訳して、空の（または自動翻訳の下書きのままの）訳欄に、下書きとして入れる。run は、この翻訳の番号 */
  const translateExample = async (index: number, run: number) => {
    const isStale = () => exampleRuns.current.get(index) !== run;
    const before = latest.current;
    const example = exampleText(before.value, index).trim();
    if (!example) {
      // 例文を消したら、自動翻訳の下書きも消す
      const plan = planAutoWrite(exampleTranslation(before.value, index), exampleDraft(before.value, index), null, "");
      setStatus(index, IDLE);
      if (plan.write) {
        setValue((prev) => (exampleTranslation(prev, index) === exampleTranslation(before.value, index) ? withDraft(prev, index, "") : prev));
      }
      return;
    }

    setStatus(index, { state: "loading", message: null });
    const result = await draftExampleTranslation(example, translate);
    if (isStale()) return;

    if (result.status === "failed") {
      console.warn("[autofill] 例文の翻訳に失敗:", result.detail);
      setStatus(index, { state: "failed", message: result.reason });
      return;
    }
    setStatus(index, IDLE);
    if (result.status !== "ok") return;

    const now = latest.current;
    // 翻訳している間に、例文がさらに変わっていたら、次の翻訳に任せる
    if (exampleText(now.value, index).trim() !== example) return;
    const plan = planAutoWrite(exampleTranslation(now.value, index), exampleDraft(now.value, index), result.text, "");
    if (!plan.write) return;
    // あなたが、その間に訳を書き込んでいたら、書き込まない
    setValue((prev) =>
      exampleText(prev, index).trim() === example && exampleTranslation(prev, index) === exampleTranslation(now.value, index) ? withDraft(prev, index, plan.value) : prev
    );
  };

  // 例文の訳: 例文（何個あっても、1つずつ）の入力・貼り付けが止まったら、英語から日本語に訳して、訳欄に下書きとして入れる
  // 変わった例文だけを訳す。ほかの例文の入力で、待ち時間をやり直さない
  const textsKey = value.examples.map((example) => example.text).join("\u0000");
  useEffect(() => {
    const texts = latest.current.value.examples.map((example) => example.text);
    texts.forEach((text, index) => {
      if (text === (previousTexts.current[index] ?? "")) return;
      const waiting = exampleTimers.current.get(index);
      if (waiting) clearTimeout(waiting);
      const run = (exampleRuns.current.get(index) ?? 0) + 1;
      exampleRuns.current.set(index, run);
      exampleTimers.current.set(
        index,
        setTimeout(() => {
          exampleTimers.current.delete(index);
          void translateExample(index, run);
        }, exampleDelayMs)
      );
    });
    // 削除されて、なくなった例文の予定は、取り消す
    for (const index of [...exampleTimers.current.keys()]) {
      if (index < texts.length) continue;
      clearTimeout(exampleTimers.current.get(index));
      exampleTimers.current.delete(index);
      exampleRuns.current.delete(index);
    }
    if (texts.length < previousTexts.current.length) setTranslationStatuses((prev) => prev.slice(0, texts.length));
    previousTexts.current = texts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textsKey]);

  // 画面を閉じるときは、待っている翻訳を取り消す
  useEffect(() => {
    const timers = exampleTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      exampleRuns.current = new Map();
    };
  }, []);

  /** 入力欄を空に戻したあと（続けて追加するとき）に、自動入力の記録も消す */
  const reset = useCallback(() => {
    setAutoPartOfSpeech(null);
    setAutoMeaning(null);
    setMeaningStatus(IDLE);
    setTranslationStatuses([]);
    exampleTimers.current.forEach((timer) => clearTimeout(timer));
    exampleTimers.current.clear();
    exampleRuns.current = new Map();
  }, []);

  return { autoPartOfSpeech, autoMeaning, meaningStatus, translationStatuses, reset };
}
