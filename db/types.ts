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
  /** ing_or_to の答え（"ing" または "to"） */
  answer: string;
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
};
