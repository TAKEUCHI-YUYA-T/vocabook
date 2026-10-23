import { localDay } from "../day";
import { LATEST_SCHEMA_VERSION, migrate } from "../migrations";
import {
  DEFAULT_DECK_NAME,
  ensureDefaultDeck,
  normalizeIngOrTo,
  PRESET_ING_OR_TO_DECK_ID,
  syncPresets,
  type PresetData,
} from "../presets";
import { createRepository, LIMITS, ValidationError, validateCardInput } from "../repository";
import { createTestDb } from "../testing/testDb";

const presetData = (overrides: Partial<PresetData> = {}): PresetData => ({
  version: "v1",
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
  await ensureDefaultDeck(db);
  const repo = createRepository(db);
  const [defaultDeck] = await repo.listDecks();
  return { db, repo, defaultDeck };
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

describe("同梱データの取り込み", () => {
  it("ing or to とヒントを取り込み、答えを ing / to にそろえる。単語帳の一覧には出さない", async () => {
    const { repo } = await setup();
    expect((await repo.listIngOrToCards()).map((c) => c.answer)).toEqual(["ing", "to"]);
    expect((await repo.randomTip())?.title).toBe("ヒントA");
    expect((await repo.listDecks()).some((d) => d.id === PRESET_ING_OR_TO_DECK_ID)).toBe(false);
  });

  it("タイトルのないヒントも取り込める（本文だけを表示する）", async () => {
    // build-presets.js が title を出さない形のデータでも、取り込みで失敗しない
    const { repo } = await setup(presetData({ tips: [{ id: "tip:body-only", body: "本文だけ" }] }));
    expect(await repo.randomTip()).toEqual({ id: "tip:body-only", title: "", body: "本文だけ", url: "" });
  });

  it("同じ版なら何もせず、版が変わったら入れ直す（ユーザーの単語帳は残る）", async () => {
    const { db, repo, defaultDeck } = await setup();
    await repo.addCard(defaultDeck.id, { term: "keep", meaning: "残る" });

    expect(await syncPresets(db, presetData())).toBe(false);
    expect(await syncPresets(db, presetData({ version: "v2", ingOrTo: [{ id: "ingOrTo:enjoy", term: "enjoy", answer: "～ing" }] }))).toBe(true);

    expect((await repo.listIngOrToCards()).map((c) => c.term)).toEqual(["enjoy"]);
    expect((await repo.listCards(defaultDeck.id)).map((c) => c.term)).toEqual(["keep"]);
  });

  it("以前の版で同梱していた単語帳が残っていれば消し、ユーザーの単語帳には触れない", async () => {
    const { db, repo, defaultDeck } = await setup();
    await repo.addCard(defaultDeck.id, { term: "mine", meaning: "自分の" });
    // 以前の版の状態を再現する（読み取り専用の単語帳と、その単語）
    await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES ('preset:words', '英単語・熟語（標準）', 'preset', 0, 0)");
    await db.runAsync(
      "INSERT INTO cards (id, deck_id, type, term, meaning, created_at, updated_at) VALUES ('noun:apple', 'preset:words', 'basic', 'apple', 'りんご', 0, 0)"
    );

    await syncPresets(db, presetData({ version: "v2" }));

    expect(await db.getFirstAsync("SELECT id FROM decks WHERE id = 'preset:words'")).toBeNull();
    expect(await db.getFirstAsync("SELECT id FROM cards WHERE id = 'noun:apple'")).toBeNull();
    expect((await repo.listCards(defaultDeck.id)).map((c) => c.term)).toEqual(["mine"]);
  });

  it("取り込みの途中で失敗したら、元の状態に戻る", async () => {
    const { db, repo } = await setup();
    const broken = presetData({ version: "v2", ingOrTo: [{ id: "dup", term: "a" }, { id: "dup", term: "b" }] });
    await expect(syncPresets(db, broken)).rejects.toThrow();
    expect(await repo.listIngOrToCards()).toHaveLength(2);
    expect((await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'preset_version'"))?.value).toBe("v1");
  });

  it("まとめて書き込む区切り（50行）をまたいでも、全件を順番どおりに取り込む", async () => {
    const ingOrTo = Array.from({ length: 120 }, (_, i) => ({ id: `ingOrTo:w${i}`, term: `w${i}`, answer: i % 2 ? "to～" : "～ing" }));
    const { repo } = await setup(presetData({ ingOrTo }));
    const cards = await repo.listIngOrToCards();
    expect(cards).toHaveLength(120);
    expect(cards[49].term).toBe("w49");
    expect(cards[50].term).toBe("w50");
    expect(cards[119]).toMatchObject({ term: "w119", answer: "to" });
  });

  it("ing or to の答えの書き方の違いを吸収する", () => {
    expect(normalizeIngOrTo("～ing")).toBe("ing");
    expect(normalizeIngOrTo("to～")).toBe("to");
    expect(normalizeIngOrTo("")).toBe("");
  });
});

describe("初回の空の単語帳", () => {
  it("初回だけ、空の単語帳を1つ作る", async () => {
    const { db, repo } = await setup();
    await ensureDefaultDeck(db);
    const decks = await repo.listDecks();
    expect(decks.map((d) => [d.name, d.cardCount])).toEqual([[DEFAULT_DECK_NAME, 0]]);
  });

  it("ユーザーが単語帳をすべて削除しても、作り直さない", async () => {
    const { db, repo, defaultDeck } = await setup();
    await repo.deleteDeck(defaultDeck.id);
    await ensureDefaultDeck(db);
    expect(await repo.listDecks()).toEqual([]);
  });

  it("すでに自分の単語帳があれば、作らない", async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    await repo.createDeck("既存");
    await ensureDefaultDeck(db);
    expect((await repo.listDecks()).map((d) => d.name)).toEqual(["既存"]);
  });
});

describe("データ構造の更新（版 1 → 最新）", () => {
  it("版 1 のデータは、単語も記録も失わずに更新され、フラグは未設定になる", async () => {
    const db = await createTestDb();
    await migrate(db, 1);
    const old = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(old?.user_version).toBe(1);
    await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES ('d1', 'マイ単語帳', 'user', 1, 1)");
    await db.runAsync("INSERT INTO cards (id, deck_id, type, term, meaning, created_at, updated_at) VALUES ('c1', 'd1', 'basic', 'apple', 'りんご', 1, 1)");

    await migrate(db);
    const repo = createRepository(db);
    expect(await repo.getCard("c1")).toMatchObject({ term: "apple", meaning: "りんご", flag: "" });
    await repo.recordStudied("c1", "2026-10-23"); // 追加された記録の表も、使える
    expect((await repo.homeStats("2026-10-23")).studiedToday).toBe(1);
  });

  it("フラグには、決まった値しか入れられない（データベース側でも）", async () => {
    const { db, defaultDeck, repo } = await setup();
    const card = await repo.addCard(defaultDeck.id, { term: "a", meaning: "あ" });
    await expect(db.runAsync("UPDATE cards SET flag = 'ほか' WHERE id = ?", [card.id])).rejects.toBeTruthy();
  });
});

describe("学習のフラグ（覚えた / 要復習）", () => {
  it("新しい単語はフラグなし。フラグを付ける・外す・編集で変える", async () => {
    const { repo, defaultDeck } = await setup();
    const card = await repo.addCard(defaultDeck.id, { term: "apple", meaning: "りんご" });
    expect(card.flag).toBe("");
    await repo.setFlag(card.id, "review");
    expect((await repo.getCard(card.id))?.flag).toBe("review");
    // 編集で、フラグを指定しなければ、そのまま。指定すれば、変わる
    await repo.updateCard(card.id, { term: "apple", meaning: "りんご（果物）" });
    expect((await repo.getCard(card.id))?.flag).toBe("review");
    await repo.updateCard(card.id, { term: "apple", meaning: "りんご", flag: "learned" });
    expect((await repo.getCard(card.id))?.flag).toBe("learned");
    await repo.setFlag(card.id, "");
    expect((await repo.getCard(card.id))?.flag).toBe("");
  });

  it("正しくないフラグは受け付けない。取り込みでは、フラグも保存する", async () => {
    const { repo, defaultDeck } = await setup();
    await expect(repo.addCard(defaultDeck.id, { term: "x", meaning: "y", flag: "ほか" as never })).rejects.toThrow("フラグが正しくありません");
    await repo.importCards(defaultDeck.id, [{ term: "kept", meaning: "覚えた単語", flag: "learned" }]);
    expect((await repo.listCards(defaultDeck.id))[0].flag).toBe("learned");
  });

  it("出題は、フラグ（未設定を含む）と、意味の有無で絞れる", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.importCards(defaultDeck.id, [
      { term: "a", meaning: "あ", flag: "" },
      { term: "b", meaning: "い", flag: "learned" },
      { term: "c", meaning: "う", flag: "review" },
      { term: "d", meaning: "", flag: "review" },
    ]);
    const terms = async (filter: object) => (await repo.listStudyCards({ deckIds: [defaultDeck.id], ...filter })).map((c) => c.term).sort();
    expect(await terms({})).toEqual(["a", "b", "c", "d"]);
    expect(await terms({ flags: ["review"] })).toEqual(["c", "d"]);
    expect(await terms({ flags: ["", "learned"] })).toEqual(["a", "b"]);
    expect(await terms({ flags: ["review"], requireMeaning: true })).toEqual(["c"]);
  });

  it("絞り込み画面の集計は、品詞とフラグの組み合わせごとの数と、意味のある数を返す", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.importCards(defaultDeck.id, [
      { term: "a", meaning: "あ", partOfSpeech: "noun", flag: "learned" },
      { term: "b", meaning: "", partOfSpeech: "noun", flag: "learned" },
      { term: "c", meaning: "う" },
    ]);
    const rows = await repo.studyBreakdown([defaultDeck.id]);
    expect(rows.sort((x, y) => x.partOfSpeech.localeCompare(y.partOfSpeech))).toEqual([
      { partOfSpeech: "", flag: "", count: 1, withMeaning: 1 },
      { partOfSpeech: "noun", flag: "learned", count: 2, withMeaning: 1 },
    ]);
  });
});

describe("学習の記録（ホームに出す数）", () => {
  it("今日見た単語は、同じ単語を何度見ても1回と数える。日が変われば、また数える", async () => {
    const { repo, defaultDeck } = await setup();
    const a = await repo.addCard(defaultDeck.id, { term: "a", meaning: "あ" });
    const b = await repo.addCard(defaultDeck.id, { term: "b", meaning: "い" });
    await repo.recordStudied(a.id, "2026-10-23");
    await repo.recordStudied(a.id, "2026-10-23");
    await repo.recordStudied(b.id, "2026-10-23");
    await repo.recordStudied(a.id, "2026-10-24");
    expect((await repo.homeStats("2026-10-23")).studiedToday).toBe(2);
    expect((await repo.homeStats("2026-10-24")).studiedToday).toBe(1);
    expect((await repo.homeStats("2026-10-25")).studiedToday).toBe(0);
  });

  it("「覚えた」の数と単語の総数を返す。削除した単語や、ing or to の問題は数えない", async () => {
    const { repo, defaultDeck } = await setup();
    const a = await repo.addCard(defaultDeck.id, { term: "a", meaning: "あ" });
    const b = await repo.addCard(defaultDeck.id, { term: "b", meaning: "い" });
    await repo.addCard(defaultDeck.id, { term: "c", meaning: "う" });
    await repo.setFlag(a.id, "learned");
    await repo.setFlag(b.id, "learned");
    await repo.recordStudied(b.id, "2026-10-23");
    expect(await repo.homeStats("2026-10-23")).toEqual({ studiedToday: 1, learned: 2, total: 3 });
    await repo.deleteCard(b.id);
    expect(await repo.homeStats("2026-10-23")).toEqual({ studiedToday: 0, learned: 1, total: 2 });
  });

  it("日付は、端末の日付（YYYY-MM-DD）にする", () => {
    expect(localDay(new Date(2026, 9, 3, 23, 59))).toBe("2026-10-03");
    expect(localDay(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });
});

describe("自分で足す ing or to の問題", () => {
  it("答えを付けた単語は、同梱の問題と一緒に ing or to の問題に出る。答えのない単語は出ない", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.addCard(defaultDeck.id, { term: "postpone", meaning: "延期する", partOfSpeech: "verb", answer: "ing" });
    await repo.addCard(defaultDeck.id, { term: "keep", meaning: "保つ", partOfSpeech: "verb" });
    const quiz = await repo.listIngOrToCards();
    expect(quiz.map((c) => [c.term, c.answer]).sort()).toEqual([
      ["avoid", "ing"],
      ["decide", "to"],
      ["postpone", "ing"],
    ]);
  });

  it("編集で答えを外したり、単語を削除したりすると、問題に出なくなる", async () => {
    const { repo, defaultDeck } = await setup();
    const a = await repo.addCard(defaultDeck.id, { term: "postpone", meaning: "延期する", answer: "ing" });
    const b = await repo.addCard(defaultDeck.id, { term: "agree", meaning: "同意する", answer: "to" });
    await repo.updateCard(a.id, { term: "postpone", meaning: "延期する", answer: null });
    await repo.deleteCard(b.id);
    const terms = (await repo.listIngOrToCards()).map((c) => c.term);
    expect(terms).not.toContain("postpone");
    expect(terms).not.toContain("agree");
    expect((await repo.getCard(a.id))?.answer).toBe("");
  });

  it("取り込みでも答えを保存し、正しくない答えは受け付けない", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.importCards(defaultDeck.id, [{ term: "refuse", meaning: "拒む", answer: "to" }]);
    expect((await repo.listCards(defaultDeck.id))[0].answer).toBe("to");
    await expect(repo.addCard(defaultDeck.id, { term: "x", meaning: "y", answer: "both" as never })).rejects.toThrow("ing or to の答えが正しくありません");
  });
});

describe("単語を入れる単語帳（1冊として扱う）", () => {
  it("自分の単語帳の先頭（作った順）を返し、ing or to の同梱データは選ばない", async () => {
    const { db, repo, defaultDeck } = await setup();
    await repo.createDeck("あとから作った");
    // 同じ1ミリ秒の間に作ると、順番が ID の乱数で決まるので、あとから作ったことが分かるよう時刻をずらす
    await db.runAsync("UPDATE decks SET created_at = created_at + 1000 WHERE name = 'あとから作った'");
    expect((await repo.getDefaultDeck()).id).toBe(defaultDeck.id);
  });

  it("単語帳が1冊もなければ、空の単語帳を作って返す（2回呼んでも増えない）", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.deleteDeck(defaultDeck.id);
    const created = await repo.getDefaultDeck();
    expect(created.name).toBe(DEFAULT_DECK_NAME);
    expect((await repo.getDefaultDeck()).id).toBe(created.id);
    expect(await repo.listDecks()).toHaveLength(1);
  });
});

describe("単語帳と単語の読み書き", () => {
  it("単語帳の一覧は、自分の単語帳を作った順に並べ、単語数も数える", async () => {
    const { db, repo, defaultDeck } = await setup();
    await repo.addCard(defaultDeck.id, { term: "a", meaning: "b" });
    await repo.createDeck("あとから作った");
    await db.runAsync("UPDATE decks SET created_at = created_at + 1000 WHERE name = 'あとから作った'"); // 同じ1ミリ秒の間に作ると順番が決まらないため
    const decks = await repo.listDecks();
    expect(decks.map((d) => [d.name, d.cardCount])).toEqual([
      [DEFAULT_DECK_NAME, 1],
      ["あとから作った", 0],
    ]);
  });

  it("単語を追加・編集・削除できる", async () => {
    const { repo, defaultDeck } = await setup();
    const card = await repo.addCard(defaultDeck.id, { term: "  banana ", meaning: " バナナ ", partOfSpeech: "noun" });
    expect(card).toMatchObject({ term: "banana", meaning: "バナナ", partOfSpeech: "noun", type: "basic" });

    const updated = await repo.updateCard(card.id, { term: "banana", meaning: "バナナ（果物）", example: "I like bananas." });
    expect(updated.meaning).toBe("バナナ（果物）");
    expect(updated.partOfSpeech).toBeNull();

    await repo.deleteCard(card.id);
    expect(await repo.getCard(card.id)).toBeNull();
    expect(await repo.listCards(defaultDeck.id)).toHaveLength(0);
  });

  it("同梱の ing or to は編集・削除できない", async () => {
    const { repo } = await setup();
    await expect(repo.addCard(PRESET_ING_OR_TO_DECK_ID, { term: "x", meaning: "y" })).rejects.toThrow("この単語帳は編集できません");
    await expect(repo.deleteDeck(PRESET_ING_OR_TO_DECK_ID)).rejects.toBeInstanceOf(ValidationError);
    const [first] = await repo.listIngOrToCards();
    await expect(repo.updateCard(first.id, { term: "x", meaning: "y" })).rejects.toBeInstanceOf(ValidationError);
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
    const { repo, defaultDeck } = await setup();
    const first = await repo.addCard(defaultDeck.id, { term: "Apple", meaning: "りんご" });
    expect(await repo.findDuplicates(defaultDeck.id, "apple")).toHaveLength(1);
    expect(await repo.findDuplicates(defaultDeck.id, "apple", first.id)).toHaveLength(0);
  });
});

describe("出題用の取り出し", () => {
  it("単語帳と品詞で絞り込み、ing or to は含めない", async () => {
    const { repo, defaultDeck } = await setup();
    await repo.addCard(defaultDeck.id, { term: "apple", meaning: "りんご", partOfSpeech: "noun" });
    await repo.addCard(defaultDeck.id, { term: "abolish", meaning: "廃止する", partOfSpeech: "verb" });
    await repo.addCard(defaultDeck.id, { term: "void", meaning: "無効にする", partOfSpeech: "verb" });

    expect(await repo.listStudyCards({ deckIds: [defaultDeck.id] })).toHaveLength(3);
    const verbs = await repo.listStudyCards({ deckIds: [defaultDeck.id], partsOfSpeech: ["verb"] });
    expect(verbs.map((c) => c.term).sort()).toEqual(["abolish", "void"]);
    expect(await repo.listStudyCards({ deckIds: [PRESET_ING_OR_TO_DECK_ID] })).toEqual([]);
    expect(await repo.listStudyCards({ deckIds: [] })).toEqual([]);
    expect(await repo.countByPartOfSpeech([defaultDeck.id])).toEqual({ noun: 1, verb: 2 });
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
