import { LATEST_SCHEMA_VERSION, migrate } from "../migrations";
import { normalizeIngOrTo, PRESET_WORDS_DECK_ID, syncPresets, type PresetData } from "../presets";
import { createRepository, LIMITS, ValidationError, validateCardInput } from "../repository";
import { createTestDb } from "../testing/testDb";

const presetData = (overrides: Partial<PresetData> = {}): PresetData => ({
  version: "v1",
  words: [
    { id: "noun:apple", pos: "noun", term: "apple", meaning: "りんご", example: "I ate an apple.", exampleTranslation: "りんごを食べた" },
    { id: "verb:abolish", pos: "verb", term: "abolish", meaning: "廃止する" },
    { id: "verb:void", pos: "verb", term: "void" }, // 意味が空のカードも取り込める
  ],
  ingOrTo: [
    { id: "ingOrTo:avoid", term: "avoid", answer: "～ing", meaning: "避ける" },
    { id: "ingOrTo:decide", term: "decide", answer: "to～", meaning: "決める" },
  ],
  tips: [{ id: "tip:a", title: "ヒントA", body: "本文", url: "https://example.com" }],
  ...overrides,
});

const setup = async (data: PresetData = presetData()) => {
  const db = await createTestDb();
  await migrate(db);
  await syncPresets(db, data);
  return { db, repo: createRepository(db) };
};

describe("マイグレーション", () => {
  it("新しい DB に最新の構造を作り、2回目は何もしない", async () => {
    const db = await createTestDb();
    await migrate(db);
    await migrate(db);
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(row?.user_version).toBe(LATEST_SCHEMA_VERSION);
  });

  it("アプリより新しい版のデータは、壊さずに止める", async () => {
    const db = await createTestDb();
    await db.execAsync(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow("アプリを更新してください");
  });
});

describe("プリセットの取り込み", () => {
  it("単語・ing or to・ヒントを取り込み、答えを ing / to にそろえる", async () => {
    const { repo } = await setup();
    expect(await repo.listCards(PRESET_WORDS_DECK_ID)).toHaveLength(3);
    const ingOrTo = await repo.listIngOrToCards();
    expect(ingOrTo.map((c) => c.answer)).toEqual(["ing", "to"]);
    expect((await repo.randomTip())?.title).toBe("ヒントA");
  });

  it("同じ版なら何もせず、版が変わったら入れ直す（ユーザーの単語帳は残る）", async () => {
    const { db, repo } = await setup();
    const mine = await repo.createDeck("自分用");
    await repo.addCard(mine.id, { term: "keep", meaning: "残る" });

    expect(await syncPresets(db, presetData())).toBe(false);
    expect(await syncPresets(db, presetData({ version: "v2", words: [{ id: "noun:pear", pos: "noun", term: "pear", meaning: "梨" }] }))).toBe(true);

    expect((await repo.listCards(PRESET_WORDS_DECK_ID)).map((c) => c.term)).toEqual(["pear"]);
    expect((await repo.listCards(mine.id)).map((c) => c.term)).toEqual(["keep"]);
  });

  it("取り込みの途中で失敗したら、元の状態に戻る", async () => {
    const { db, repo } = await setup();
    const broken = presetData({ version: "v2", words: [{ id: "dup", pos: "noun", term: "a" }, { id: "dup", pos: "noun", term: "b" }] });
    await expect(syncPresets(db, broken)).rejects.toThrow();
    expect(await repo.listCards(PRESET_WORDS_DECK_ID)).toHaveLength(3);
    expect((await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'preset_version'"))?.value).toBe("v1");
  });

  it("まとめて書き込む区切り（50行）をまたいでも、全件を順番どおりに取り込む", async () => {
    const words = Array.from({ length: 120 }, (_, i) => ({ id: `noun:w${i}`, pos: "noun" as const, term: `w${i}`, meaning: `意味${i}` }));
    const { repo } = await setup(presetData({ words }));
    const cards = await repo.listCards(PRESET_WORDS_DECK_ID);
    expect(cards).toHaveLength(120);
    expect(cards[0].term).toBe("w0");
    expect(cards[49].term).toBe("w49");
    expect(cards[50].term).toBe("w50");
    expect(cards[119]).toMatchObject({ term: "w119", meaning: "意味119", partOfSpeech: "noun" });
  });

  it("ing or to の答えの書き方の違いを吸収する", () => {
    expect(normalizeIngOrTo("～ing")).toBe("ing");
    expect(normalizeIngOrTo("to～")).toBe("to");
    expect(normalizeIngOrTo("")).toBe("");
  });
});

describe("単語帳と単語の読み書き", () => {
  it("単語帳の一覧に、標準が先に出て、単語数も数えられる", async () => {
    const { repo } = await setup();
    await repo.createDeck("自分用");
    const decks = await repo.listDecks();
    expect(decks.map((d) => d.kind)).toEqual(["preset", "preset", "user"]);
    expect(decks.find((d) => d.id === PRESET_WORDS_DECK_ID)?.cardCount).toBe(3);
  });

  it("単語を追加・編集・削除できる", async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck("自分用");
    const card = await repo.addCard(deck.id, { term: "  banana ", meaning: " バナナ ", partOfSpeech: "noun" });
    expect(card).toMatchObject({ term: "banana", meaning: "バナナ", partOfSpeech: "noun", type: "basic" });

    const updated = await repo.updateCard(card.id, { term: "banana", meaning: "バナナ（果物）", example: "I like bananas." });
    expect(updated.meaning).toBe("バナナ（果物）");
    expect(updated.partOfSpeech).toBeNull();

    await repo.deleteCard(card.id);
    expect(await repo.getCard(card.id)).toBeNull();
    expect(await repo.listCards(deck.id)).toHaveLength(0);
  });

  it("標準の単語帳は編集できないが、コピーすれば編集できる", async () => {
    const { repo } = await setup();
    await expect(repo.addCard(PRESET_WORDS_DECK_ID, { term: "x", meaning: "y" })).rejects.toThrow("標準の単語帳は編集できません");
    await expect(repo.deleteDeck(PRESET_WORDS_DECK_ID)).rejects.toBeInstanceOf(ValidationError);

    const copy = await repo.duplicateDeck(PRESET_WORDS_DECK_ID, "コピー");
    const cards = await repo.listCards(copy.id);
    expect(cards).toHaveLength(3);
    await repo.updateCard(cards[0].id, { term: "edited", meaning: "編集した" });
    expect((await repo.listCards(PRESET_WORDS_DECK_ID)).map((c) => c.term)).toContain("apple");
  });

  it("単語帳を削除すると、中の単語も一覧から消える", async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck("消す");
    await repo.addCard(deck.id, { term: "a", meaning: "b" });
    await repo.deleteDeck(deck.id);
    expect((await repo.listDecks()).some((d) => d.id === deck.id)).toBe(false);
    expect(await repo.listCards(deck.id)).toHaveLength(0);
  });

  it("検索は単語・意味・例文を部分一致で探し、% や _ もふつうの文字として扱う", async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck("検索");
    await repo.addCard(deck.id, { term: "100%", meaning: "ひゃくパーセント" });
    await repo.addCard(deck.id, { term: "snake_case", meaning: "命名規則" });
    await repo.addCard(deck.id, { term: "other", meaning: "ほか", example: "contains Apple inside" });

    expect((await repo.listCards(deck.id, "%")).map((c) => c.term)).toEqual(["100%"]);
    expect((await repo.listCards(deck.id, "_")).map((c) => c.term)).toEqual(["snake_case"]);
    expect((await repo.listCards(deck.id, "apple")).map((c) => c.term)).toEqual(["other"]);
    expect((await repo.listCards(deck.id, "命名")).map((c) => c.term)).toEqual(["snake_case"]);
  });

  it("重複する単語を、大文字小文字を区別せずに見つける", async () => {
    const { repo } = await setup();
    const deck = await repo.createDeck("重複");
    const first = await repo.addCard(deck.id, { term: "Apple", meaning: "りんご" });
    expect(await repo.findDuplicates(deck.id, "apple")).toHaveLength(1);
    expect(await repo.findDuplicates(deck.id, "apple", first.id)).toHaveLength(0);
  });
});

describe("出題用の取り出し", () => {
  it("単語帳と品詞で絞り込み、ing or to は含めない", async () => {
    const { repo } = await setup();
    const all = await repo.listStudyCards({ deckIds: [PRESET_WORDS_DECK_ID] });
    expect(all).toHaveLength(3);
    const verbs = await repo.listStudyCards({ deckIds: [PRESET_WORDS_DECK_ID], partsOfSpeech: ["verb"] });
    expect(verbs.map((c) => c.term).sort()).toEqual(["abolish", "void"]);
    expect(await repo.listStudyCards({ deckIds: [] })).toEqual([]);
    expect(await repo.countByPartOfSpeech([PRESET_WORDS_DECK_ID])).toEqual({ noun: 1, verb: 2 });
  });
});

describe("入力の検証", () => {
  it("必須項目・長さ・品詞を確かめる", () => {
    expect(() => validateCardInput({ term: " ", meaning: "x" })).toThrow("単語を入力してください");
    expect(() => validateCardInput({ term: "x", meaning: "" })).toThrow("意味を入力してください");
    expect(() => validateCardInput({ term: "x".repeat(LIMITS.term + 1), meaning: "y" })).toThrow("200文字以内");
    expect(() => validateCardInput({ term: "x", meaning: "y", partOfSpeech: "bogus" as never })).toThrow("品詞が正しくありません");
    expect(validateCardInput({ term: " a ", meaning: " b " })).toMatchObject({ term: "a", meaning: "b", partOfSpeech: null });
  });
});
