/**
 * アプリのデータの型
 * 将来の同期や共有に備えて、ID は UUID（またはプリセットの固定 ID）、
 * 削除は論理削除（deletedAt）にしている
 */

/** 品詞。単語ごとの属性で、出題の絞り込みに使う */
export const PARTS_OF_SPEECH = [
  { key: "noun", label: "名詞" },
  { key: "verb", label: "動詞" },
  { key: "adverb", label: "副詞" },
  { key: "adjective", label: "形容詞" },
  { key: "preposition", label: "前置詞" },
  { key: "conjunction", label: "接続詞" },
  { key: "auxiliaryVerb", label: "助動詞" },
  { key: "idiom", label: "熟語" },
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]["key"];

export const partOfSpeechLabel = (key: string | null | undefined): string =>
  PARTS_OF_SPEECH.find((p) => p.key === key)?.label ?? "";

/** 学習のフラグ。"" は未設定、learned は「覚えた」、review は「要復習」 */
export type CardFlag = "" | "learned" | "review";

/** フラグの表示名（未設定は表示しない） */
export const FLAG_LABELS: Record<Exclude<CardFlag, "">, string> = { learned: "覚えた", review: "要復習" };

export const flagLabel = (flag: string | null | undefined): string => (flag === "learned" || flag === "review" ? FLAG_LABELS[flag] : "");

/** 文字列を、フラグにする（不明な値は未設定） */
export const toFlag = (value: string | null | undefined): CardFlag => (value === "learned" || value === "review" ? value : "");

/** ing or to の答え。動詞などのあとに続くのが「～ing」か「to～」か */
export type IngOrToAnswer = "ing" | "to";

/** ing or to の答えの表記（シート・画面・書き出しで共通） */
export const ING_OR_TO_LABELS: Record<IngOrToAnswer, string> = { ing: "～ing", to: "to～" };

export const ingOrToLabel = (answer: string | null | undefined): string => (answer === "ing" || answer === "to" ? ING_OR_TO_LABELS[answer] : "");

/** 単語帳。preset は同梱（読み取り専用）、user はユーザーが作ったもの */
export type DeckKind = "preset" | "user";

export type Deck = {
  id: string;
  name: string;
  kind: DeckKind;
  createdAt: number;
  updatedAt: number;
};

/** 単語帳と、その中の単語（カード）の数 */
export type DeckSummary = Deck & { cardCount: number };

/** カードの種類。basic は「単語 → 意味」、ing_or_to は ing / to を答える問題 */
export type CardType = "basic" | "ing_or_to";

export type Card = {
  id: string;
  deckId: string;
  type: CardType;
  term: string;
  meaning: string;
  partOfSpeech: PartOfSpeech | null;
  example: string;
  exampleTranslation: string;
  note: string;
  /**
   * ing or to の答え（"ing" または "to"）
   * ing_or_to（同梱の問題）は必ず入る。basic（自分の単語）は、ing or to の問題にも出すときだけ入る（空なら出さない）
   */
  answer: string;
  /** 学習のフラグ（覚えた / 要復習 / 未設定） */
  flag: CardFlag;
  position: number;
  createdAt: number;
  updatedAt: number;
};

/** 追加・編集フォームで扱う値。必須は term と meaning のみ */
export type CardInput = {
  term: string;
  meaning: string;
  partOfSpeech?: PartOfSpeech | null;
  example?: string;
  exampleTranslation?: string;
  note?: string;
  /** ing or to の問題にも出すときの答え（null なら出さない） */
  answer?: IngOrToAnswer | null;
  /** 学習のフラグ。省略すると、追加では未設定、更新では今の値のまま */
  flag?: CardFlag;
};

/** ホームに出すヒント（同梱のみ） */
export type Tip = {
  id: string;
  title: string;
  body: string;
  url: string;
};

/** 出題の絞り込み条件 */
export type StudyFilter = {
  deckIds: string[];
  partsOfSpeech?: PartOfSpeech[];
  /** 絞り込むフラグ（"" は未設定）。空・省略なら、すべて */
  flags?: CardFlag[];
  /** 意味のある単語だけ（日本語を見て英語を答える出題のため） */
  requireMeaning?: boolean;
};

/** 出題の向き。en-ja は英語→日本語、ja-en は日本語→英語、listen は音声→意味 */
export type StudyDirection = "en-ja" | "ja-en" | "listen";

/** 今日の学習の記録（ホームに出す） */
export type HomeStats = {
  /** 今日、答えを見た単語の数（同じ単語は1回と数える） */
  studiedToday: number;
  /** フラグが「覚えた」の単語の数 */
  learned: number;
  /** 単語の総数 */
  total: number;
};
