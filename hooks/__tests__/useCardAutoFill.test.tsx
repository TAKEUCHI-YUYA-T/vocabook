import * as React from "react";
import renderer, { act } from "react-test-renderer";
import { emptyCardForm, type CardFormValue } from "@/components/CardForm";
import type { TranslateFn } from "@/db/draft";
import type { PartOfSpeech } from "@/db/types";
import { EXAMPLE_DELAY_MS, MEANING_DELAY_MS, TERM_DELAY_MS, useCardAutoFill } from "../useCardAutoFill";

type Api = { value: CardFormValue; setValue: React.Dispatch<React.SetStateAction<CardFormValue>>; fill: ReturnType<typeof useCardAutoFill> };

const dictionary: Record<string, PartOfSpeech> = { abolish: "verb", happy: "adjective", candidate: "noun", can: "auxiliaryVerb" };
const guess = (term: string) => dictionary[term.trim().toLowerCase()] ?? null;

const translation = (map: Record<string, string>) =>
  jest.fn<ReturnType<TranslateFn>, Parameters<TranslateFn>>(async ({ input }) => ({ translatedTexts: map[input] ?? "（訳）", sourceLanguage: "en" }));

let api!: Api;

function Harness({ initial, options }: { initial: CardFormValue; options?: Parameters<typeof useCardAutoFill>[2] }) {
  const [value, setValue] = React.useState(initial);
  api = { value, setValue, fill: useCardAutoFill(value, setValue, options) };
  return null;
}

const mount = async (initial: CardFormValue, options?: Parameters<typeof useCardAutoFill>[2]) => {
  await act(async () => {
    renderer.create(<Harness initial={initial} options={options} />);
  });
};

/** 入力して、待ち時間が過ぎるまで進める（翻訳の完了も待つ） */
const typeAndWait = async (patch: Partial<CardFormValue>, ms: number) => {
  await act(async () => {
    api.setValue((prev) => ({ ...prev, ...patch }));
  });
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("品詞の自動入力", () => {
  it("単語を入力して待つと、品詞が空の欄に入り、自動で入ったと分かる", async () => {
    await mount(emptyCardForm(), { guess, translate: translation({}) });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBe("verb");
    expect(api.fill.autoPartOfSpeech).toBe("verb");
  });

  it("待ち時間の前は入れない（入力の途中で、品詞が何度も変わらない）", async () => {
    await mount(emptyCardForm(), { guess, translate: translation({}) });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS - 50);
    expect(api.value.partOfSpeech).toBeNull();
  });

  it("あなたが選んだ品詞は、上書きしない", async () => {
    await mount({ ...emptyCardForm(), partOfSpeech: "noun" }, { guess, translate: translation({}) });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBe("noun");
    expect(api.fill.autoPartOfSpeech).toBeNull();
  });

  it("自動で入れた品詞は、単語を直すと入れ替わり、推定できなくなると消える", async () => {
    await mount(emptyCardForm(), { guess, translate: translation({}) });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS);
    await typeAndWait({ term: "happy" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBe("adjective");
    await typeAndWait({ term: "happyyy" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBeNull();
    expect(api.fill.autoPartOfSpeech).toBeNull();
  });

  it("入力の途中で、品詞を選び直したら、そのあとの自動入力で上書きしない", async () => {
    await mount(emptyCardForm(), { guess, translate: translation({}) });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS);
    await act(async () => {
      api.setValue((prev) => ({ ...prev, partOfSpeech: "idiom" }));
    });
    await typeAndWait({ term: "happy" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBe("idiom");
  });

  it("開いた時点の単語では自動入力しない（編集画面）。他のアプリから登録する画面では、最初から推定する", async () => {
    await mount({ ...emptyCardForm(), term: "abolish" }, { guess, translate: translation({}) });
    await act(async () => {
      jest.advanceTimersByTime(TERM_DELAY_MS * 2);
    });
    expect(api.value.partOfSpeech).toBeNull();

    await mount({ ...emptyCardForm(), term: "abolish" }, { guess, translate: translation({}), guessInitialTerm: true });
    await act(async () => {
      jest.advanceTimersByTime(TERM_DELAY_MS * 2);
    });
    expect(api.value.partOfSpeech).toBe("verb");
  });

  it("辞書の読み込みに失敗しても、例外にせず、品詞を空のままにする", async () => {
    await mount(emptyCardForm(), {
      guess: () => {
        throw new Error("辞書なし");
      },
      translate: translation({}),
    });
    await typeAndWait({ term: "abolish" }, TERM_DELAY_MS);
    expect(api.value.partOfSpeech).toBeNull();
  });
});

describe("意味の自動入力", () => {
  it("単語を入力して待つと、日本語の意味が空の欄に入り、自動で入ったと分かる", async () => {
    const translate = translation({ abolish: "廃止する" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS);
    expect(api.value.meaning).toBe("廃止する");
    expect(api.fill.autoMeaning).toBe("廃止する");
    expect(api.fill.meaningStatus.state).toBe("idle");
    expect(translate).toHaveBeenCalledWith({ input: "abolish", sourceLangCode: "en", targetLangCode: "ja" });
  });

  it("待ち時間の前は訳さない（入力の途中で、何度も翻訳しない）", async () => {
    const translate = translation({});
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS - 100);
    expect(translate).not.toHaveBeenCalled();
  });

  it("あなたが入力した意味は、上書きしない", async () => {
    await mount({ ...emptyCardForm(), meaning: "自分の意味" }, { guess, translate: translation({ abolish: "廃止する" }) });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS);
    expect(api.value.meaning).toBe("自分の意味");
  });

  it("自動で入れた意味は、単語を直すと入れ直し、訳せない単語になったら消える", async () => {
    const translate = translation({ abolish: "廃止する", happy: "幸せな" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS);
    await typeAndWait({ term: "happy" }, MEANING_DELAY_MS);
    expect(api.value.meaning).toBe("幸せな");
    await typeAndWait({ term: "avoid ～ing" }, MEANING_DELAY_MS); // ～を含む表現は訳さない
    expect(api.value.meaning).toBe("");
    expect(api.fill.autoMeaning).toBeNull();
  });

  it("かっこの中の補足を除いて訳す", async () => {
    const translate = translation({ divide: "分ける" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "divide (into)" }, MEANING_DELAY_MS);
    expect(translate).toHaveBeenCalledWith({ input: "divide", sourceLangCode: "en", targetLangCode: "ja" });
    expect(api.value.meaning).toBe("分ける");
  });

  it("開いた時点の単語では訳さない（編集画面）。他のアプリから登録する画面では、最初から訳す", async () => {
    const translate = translation({ abolish: "廃止する" });
    await mount({ ...emptyCardForm(), term: "abolish" }, { guess, translate });
    await act(async () => {
      jest.advanceTimersByTime(MEANING_DELAY_MS * 2);
    });
    expect(translate).not.toHaveBeenCalled();
    expect(api.value.meaning).toBe("");

    await mount({ ...emptyCardForm(), term: "abolish" }, { guess, translate, guessInitialTerm: true });
    await act(async () => {
      jest.advanceTimersByTime(MEANING_DELAY_MS * 2);
    });
    expect(api.value.meaning).toBe("廃止する");
  });

  it("翻訳が失敗しても、例外にせず、理由を出して、入力はそのまま続けられる", async () => {
    const translate: TranslateFn = async () => {
      throw new Error("PARAMETER_ERROR: something");
    };
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS);
    expect(api.fill.meaningStatus).toEqual({ state: "failed", message: "翻訳できませんでした。意味は手で入力してください" });
    expect(api.value.meaning).toBe("");
  });

  it("訳している間に単語が変わったら、古い訳は入れず、新しい単語の訳を入れる", async () => {
    const resolvers: Record<string, (value: Awaited<ReturnType<TranslateFn>>) => void> = {};
    const translate: TranslateFn = ({ input }) => new Promise((resolve) => (resolvers[input] = resolve));
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ term: "abolish" }, MEANING_DELAY_MS);
    await typeAndWait({ term: "happy" }, MEANING_DELAY_MS);
    await act(async () => resolvers.abolish({ translatedTexts: "古い訳", sourceLanguage: "en" }));
    expect(api.value.meaning).toBe("");
    await act(async () => resolvers.happy({ translatedTexts: "幸せな", sourceLanguage: "en" }));
    expect(api.value.meaning).toBe("幸せな");
  });
});

describe("例文の訳の自動入力", () => {
  const SENTENCE = "I agree with the plan.";

  it("英語の例文を入力・貼り付けて待つと、訳が空の欄に入る", async () => {
    const translate = translation({ [SENTENCE]: "私はその案に賛成です。" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    expect(api.value.exampleTranslation).toBe("私はその案に賛成です。");
    expect(api.fill.autoTranslation).toBe("私はその案に賛成です。");
    expect(api.fill.translationStatus.state).toBe("idle");
    expect(translate).toHaveBeenCalledWith({ input: SENTENCE, sourceLangCode: "en", targetLangCode: "ja" });
  });

  it("訳している間は loading になる", async () => {
    let finish!: (value: Awaited<ReturnType<TranslateFn>>) => void;
    const translate: TranslateFn = () => new Promise((resolve) => (finish = resolve));
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    expect(api.fill.translationStatus.state).toBe("loading");
    await act(async () => finish({ translatedTexts: "訳", sourceLanguage: "en" }));
    expect(api.fill.translationStatus.state).toBe("idle");
    expect(api.value.exampleTranslation).toBe("訳");
  });

  it("あなたが入力した訳は、上書きしない", async () => {
    await mount({ ...emptyCardForm(), exampleTranslation: "自分の訳" }, { guess, translate: translation({}) });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    expect(api.value.exampleTranslation).toBe("自分の訳");
  });

  it("自動で入れた訳は、例文を直すと入れ直し、例文を消すと一緒に消える", async () => {
    const translate = translation({ [SENTENCE]: "訳A", "I agree.": "訳B" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    await typeAndWait({ example: "I agree." }, EXAMPLE_DELAY_MS);
    expect(api.value.exampleTranslation).toBe("訳B");
    await typeAndWait({ example: "" }, EXAMPLE_DELAY_MS);
    expect(api.value.exampleTranslation).toBe("");
    expect(api.fill.autoTranslation).toBeNull();
  });

  it("訳を手で直したあとは、例文を変えても上書きしない", async () => {
    const translate = translation({ [SENTENCE]: "訳A" });
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    await act(async () => {
      api.setValue((prev) => ({ ...prev, exampleTranslation: "訳Aを手で直した" }));
    });
    await typeAndWait({ example: "I agree." }, EXAMPLE_DELAY_MS);
    expect(api.value.exampleTranslation).toBe("訳Aを手で直した");
  });

  it("日本語の例文は訳さない。開いた時点の例文でも訳さない（編集画面）", async () => {
    const translate = translation({});
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: "彼は来た。" }, EXAMPLE_DELAY_MS);
    expect(translate).not.toHaveBeenCalled();

    await mount({ ...emptyCardForm(), example: SENTENCE }, { guess, translate });
    await act(async () => {
      jest.advanceTimersByTime(EXAMPLE_DELAY_MS * 2);
    });
    expect(translate).not.toHaveBeenCalled();
    expect(api.value.exampleTranslation).toBe("");
  });

  it("翻訳が失敗しても、例外にせず、理由を出して、入力はそのまま続けられる", async () => {
    const translate: TranslateFn = async () => {
      throw new Error("PARAMETER_ERROR: something");
    };
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    expect(api.fill.translationStatus).toEqual({ state: "failed", message: "翻訳できませんでした。訳は手で入力してください" });
    expect(api.value.exampleTranslation).toBe("");
  });

  it("訳している間に例文が変わったら、古い訳は入れず、新しい例文の訳を入れる", async () => {
    const resolvers: Record<string, (value: Awaited<ReturnType<TranslateFn>>) => void> = {};
    const translate: TranslateFn = ({ input }) => new Promise((resolve) => (resolvers[input] = resolve));
    await mount(emptyCardForm(), { guess, translate });
    await typeAndWait({ example: SENTENCE }, EXAMPLE_DELAY_MS);
    await typeAndWait({ example: "I agree." }, EXAMPLE_DELAY_MS);
    await act(async () => resolvers[SENTENCE]({ translatedTexts: "古い訳", sourceLanguage: "en" }));
    expect(api.value.exampleTranslation).toBe("");
    await act(async () => resolvers["I agree."]({ translatedTexts: "新しい訳", sourceLanguage: "en" }));
    expect(api.value.exampleTranslation).toBe("新しい訳");
  });

  it("reset で、自動入力の記録を消せる（続けて追加するとき）", async () => {
    await mount(emptyCardForm(), { guess, translate: translation({ [SENTENCE]: "訳A" }) });
    await typeAndWait({ term: "abolish", example: SENTENCE }, EXAMPLE_DELAY_MS);
    expect(api.fill.autoPartOfSpeech).toBe("verb");
    await act(async () => {
      api.setValue(emptyCardForm());
      api.fill.reset();
    });
    expect(api.fill.autoPartOfSpeech).toBeNull();
    expect(api.fill.autoTranslation).toBeNull();
  });
});
