import { appendExtraToNote, extraExamplesNote, joinNumbered, pairExamples, splitNumbered } from "../examples";
import { migrate } from "../migrations";
import { syncPresets } from "../presets";
import { createRepository, MAX_EXAMPLES, ValidationError } from "../repository";
import { createTestDb } from "../testing/testDb";

describe("複数の文の分け方（splitNumbered）", () => {
  it("丸数字や(1)・1. の番号、空行で分け、番号は本文から外す", () => {
    expect(splitNumbered("①I have a concern.\n\n②Our chief concern is the weather.")).toEqual([
      { marker: 1, body: "I have a concern." },
      { marker: 2, body: "Our chief concern is the weather." },
    ]);
    expect(splitNumbered("1. A\n2) B\n(3) C").map((b) => [b.marker, b.body])).toEqual([[1, "A"], [2, "B"], [3, "C"]]);
    expect(splitNumbered("First.\n\nSecond.").map((b) => [b.marker, b.body])).toEqual([[null, "First."], [null, "Second."]]);
  });

  it("番号のない続きの行は、前の文につなげる。番号も空行もなければ1つ。空なら0", () => {
    expect(splitNumbered("①Long sentence\ncontinues here.\n②Next.").map((b) => b.body)).toEqual(["Long sentence continues here.", "Next."]);
    expect(splitNumbered("Despite the rain, we went out.")).toHaveLength(1);
    expect(splitNumbered("  \n ")).toEqual([]);
  });

  it("文中の数字は分けない", () => {
    expect(splitNumbered("The fee is $10 per 2 people.").map((b) => b.body)).toEqual(["The fee is $10 per 2 people."]);
  });
});

describe("英文と訳の対応づけ（pairExamples）", () => {
  it("数が同じなら、順番に対にする", () => {
    const { examples, ambiguous, overflow } = pairExamples("①A one.\n②B two.", "①訳1\n②訳2");
    expect(examples).toEqual([{ text: "A one.", translation: "訳1" }, { text: "B two.", translation: "訳2" }]);
    expect(ambiguous || overflow).toBe(false);
  });

  it("訳が1つだけで、英文が1つなら、そのまま1組", () => {
    expect(pairExamples("I agree.", "賛成です。").examples).toEqual([{ text: "I agree.", translation: "賛成です。" }]);
  });

  it("訳の数が合わなくても、番号があれば番号で対にする", () => {
    expect(pairExamples("①A.\n②B.\n③C.", "③訳C").examples).toEqual([
      { text: "A.", translation: "" },
      { text: "B.", translation: "" },
      { text: "C.", translation: "訳C" },
    ]);
  });

  it("対応づけられないときは、訳を捨てず、1つ目にまとめる（ambiguous）", () => {
    const result = pairExamples("①A.\n②B.", "訳だけ");
    expect(result.ambiguous).toBe(true);
    expect(result.examples).toEqual([{ text: "A.", translation: "訳だけ" }, { text: "B.", translation: "" }]);
  });

  it("英文が上限（20個）を超えたら、超えた分は extra に分ける（overflow）。英文のない訳も残す", () => {
    expect(MAX_EXAMPLES).toBe(20);
    const many = Array.from({ length: 22 }, (_, i) => `${i + 1}. S${i + 1}.`).join("\n");
    const result = pairExamples(many, "");
    expect(result.examples).toHaveLength(20);
    expect(result.extra.map((e) => e.text)).toEqual(["S21.", "S22."]);
    expect(pairExamples("①A.\n②B.\n③C.\n④D.\n⑤E.", "").overflow).toBe(false); // 3つや5つは、そのまま持てる
    expect(pairExamples("", "訳だけ").examples).toEqual([{ text: "", translation: "訳だけ" }]);
  });

  it("上限を指定すると（古い構造の移行用に、3）、超えた分は extra に分け、メモ用の文にできる", () => {
    const result = pairExamples("①A.\n②B.\n③C.\n④D.\n⑤E.", "①1\n②2\n③3\n④4\n⑤5", 3);
    expect(result.overflow).toBe(true);
    expect(result.examples[2]).toEqual({ text: "C.", translation: "3" });
    expect(result.extra).toEqual([{ text: "D.", translation: "4" }, { text: "E.", translation: "5" }]);
    expect(extraExamplesNote(result.extra, 3)).toBe("例文の続き\n④D.\n4\n⑤E.\n5");
    expect(appendExtraToNote("既存のメモ", result.extra, 3)).toBe("既存のメモ\n\n例文の続き\n④D.\n4\n⑤E.\n5");
  });

  it("番号つきにまとめて（joinNumbered）、また分けると、元に戻る（途中の訳が空でも、位置はずれない）", () => {
    const original = [{ text: "A.", translation: "訳A" }, { text: "B.", translation: "" }, { text: "C.", translation: "訳C" }];
    expect(joinNumbered(original.map((e) => e.text))).toBe("①A.\n②B.\n③C.");
    expect(joinNumbered(original.map((e) => e.translation))).toBe("①訳A\n③訳C");
    expect(pairExamples(joinNumbered(original.map((e) => e.text)), joinNumbered(original.map((e) => e.translation))).examples).toEqual(original);
    expect(joinNumbered(["Only one."])).toBe("Only one.");
  });
});

describe("例文の保存", () => {
  const setup = async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    return { db, repo, deck: await repo.createDeck("テスト") };
  };

  it("最大3つまで保存でき、空の例文は保存しない。読み出すと、同じ順で戻る", async () => {
    const { repo, deck } = await setup();
    const card = await repo.addCard(deck.id, {
      term: "concern",
      meaning: "心配",
      examples: [
        { text: " I have a concern. ", translation: " 懸念がある。 " },
        { text: "", translation: "" },
        { text: "Our chief concern is the weather.", translation: "" },
      ],
    });
    expect(card.examples).toEqual([
      { text: "I have a concern.", translation: "懸念がある。" },
      { text: "Our chief concern is the weather.", translation: "" },
    ]);
    const updated = await repo.updateCard(card.id, { term: "concern", meaning: "心配", examples: [] });
    expect(updated.examples).toEqual([]);
  });

  it("20個まで保存でき、21個以上は保存できない。順番も、そのまま戻る", async () => {
    const { repo, deck } = await setup();
    const make = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `s${i + 1}`, translation: `t${i + 1}` }));
    const card = await repo.addCard(deck.id, { term: "many", meaning: "たくさん", examples: make(MAX_EXAMPLES) });
    expect(card.examples).toEqual(make(20));
    await expect(repo.addCard(deck.id, { term: "x", meaning: "y", examples: make(MAX_EXAMPLES + 1) })).rejects.toThrow(ValidationError);
    await expect(repo.updateCard(card.id, { term: "many", meaning: "たくさん", examples: make(21) })).rejects.toThrow("20個まで");
    // 編集で、数を減らしても、増やしても、入れ替わる（古い例文が残らない）
    expect((await repo.updateCard(card.id, { term: "many", meaning: "たくさん", examples: make(2) })).examples).toEqual(make(2));
    expect((await repo.updateCard(card.id, { term: "many", meaning: "たくさん", examples: make(5) })).examples).toEqual(make(5));
  });

  it("一覧で取り出す単語にも、例文が付く（取り込みでまとめて追加した単語も）", async () => {
    const { repo, deck } = await setup();
    await repo.importCards(deck.id, [
      { term: "a", meaning: "あ", examples: [{ text: "A1", translation: "" }, { text: "A2", translation: "" }] },
      { term: "b", meaning: "い" },
    ]);
    expect((await repo.listCards(deck.id)).map((c) => [c.term, c.examples.map((e) => e.text)])).toEqual([["a", ["A1", "A2"]], ["b", []]]);
  });

  it("検索は、3つの例文のどれにも当たる", async () => {
    const { repo, deck } = await setup();
    await repo.addCard(deck.id, { term: "x", meaning: "y", examples: [{ text: "a", translation: "" }, { text: "b", translation: "" }, { text: "has Pear here", translation: "" }] });
    expect((await repo.listCards(deck.id, "pear")).map((c) => c.term)).toEqual(["x"]);
  });
});

describe("データの整形（移行4: 例文を最大3つに分ける）", () => {
  const SQL_INSERT =
    "INSERT INTO cards (id, deck_id, type, term, meaning, part_of_speech, example, example_translation, note, answer, position, created_at, updated_at) VALUES (?, 'd', ?, ?, 'm', NULL, ?, ?, '', '', 0, 1, 1)";

  /** 移行3までの構造で、古い形式の単語を入れてから、最新に更新する */
  const oldDb = async (rows: [string, "basic" | "ing_or_to", string, string, string][]) => {
    const db = await createTestDb();
    await migrate(db, 3);
    await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES ('d', 'テスト', 'user', 1, 1)");
    for (const row of rows) await db.runAsync(SQL_INSERT, row);
    await migrate(db);
    return { db, repo: createRepository(db) };
  };

  it("「①…②…」を、例文ごとに分け、番号は外す。訳も、同じ番号で対にする", async () => {
    const { repo } = await oldDb([
      ["c1", "basic", "concern", "①I have a concern in the business.\n\n②Our chief concern at the moment is the weather.", "①私は仕事に懸念がある。\n\n②目下の最大の関心事は天気だ。"],
    ]);
    expect((await repo.getCard("c1"))?.examples).toEqual([
      { text: "I have a concern in the business.", translation: "私は仕事に懸念がある。" },
      { text: "Our chief concern at the moment is the weather.", translation: "目下の最大の関心事は天気だ。" },
    ]);
  });

  it("例文が1つだけの単語は、そのまま。訳だけが残っている単語も、訳を失わない", async () => {
    const { db, repo } = await oldDb([
      ["c1", "basic", "abolish", "They abolished it.", "それを廃止した。"],
      ["c2", "basic", "void", "", "訳だけ"],
      ["c3", "basic", "empty", "", ""],
    ]);
    expect((await repo.getCard("c1"))?.examples).toEqual([{ text: "They abolished it.", translation: "それを廃止した。" }]);
    expect((await repo.getCard("c2"))?.examples).toEqual([{ text: "", translation: "訳だけ" }]);
    expect((await repo.getCard("c3"))?.examples).toEqual([]);
    // 変わらなかった単語は、バックアップに入れない
    expect(await db.getAllAsync("SELECT card_id FROM example_migration_backup")).toEqual([]);
  });

  it("整形で変わった単語は、元の値をバックアップに残す。ing or to の問題は触らない", async () => {
    const { db, repo } = await oldDb([
      ["c1", "basic", "concern", "①A.\n②B.", "訳"],
      ["i1", "ing_or_to", "avoid", "Please avoid making noise.（騒ぐのを避けてください）", ""],
    ]);
    expect(await db.getAllAsync("SELECT card_id, example, example_translation FROM example_migration_backup")).toEqual([
      { card_id: "c1", example: "①A.\n②B.", example_translation: "訳" },
    ]);
    expect((await repo.getCard("i1"))?.examples).toEqual([{ text: "Please avoid making noise.（騒ぐのを避けてください）", translation: "" }]);
  });

  it("4つ以上の例文も、すべて例文になる（メモには残らない）。元のメモは、バックアップに残る", async () => {
    const { db, repo } = await oldDb([["c1", "basic", "deny", "①A.\n\n②B.\n\n③C.\n\n④D.\n\n⑤E.", "①訳A\n\n②訳B\n\n③訳C\n\n④訳D\n\n⑤訳E"]]);
    const card = await repo.getCard("c1");
    expect(card?.examples).toEqual([
      { text: "A.", translation: "訳A" },
      { text: "B.", translation: "訳B" },
      { text: "C.", translation: "訳C" },
      { text: "D.", translation: "訳D" },
      { text: "E.", translation: "訳E" },
    ]);
    expect(card?.note).toBe("");
    expect(await db.getAllAsync("SELECT note FROM example_migration_backup")).toEqual([{ note: "" }]);
  });

  it("移行4だけが済んだ状態（4つ目以降が、メモにある）から更新すると、メモの「例文の続き」だけが消え、例文に戻る", async () => {
    const db = await createTestDb();
    await migrate(db, 3);
    await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES ('d', 'テスト', 'user', 1, 1)");
    await db.runAsync(SQL_INSERT, ["c1", "basic", "deny", "①A.\n\n②B.\n\n③C.\n\n④D.\n\n⑤E.", "①訳A\n\n②訳B\n\n③訳C\n\n④訳D\n\n⑤訳E"]);
    await db.runAsync(SQL_INSERT, ["c2", "basic", "rather", "①P.\n②Q.\n③R.\n④S.", ""]);
    await migrate(db, 4);
    // 移行4のあとで、あなたが、1つ目の例文とメモを直した（c1）。c2 は、メモを書き換えた
    await db.runAsync("UPDATE cards SET example = 'A（直した）', note = '覚え方' || char(10) || char(10) || note WHERE id = 'c1'");
    await db.runAsync("UPDATE cards SET note = '例文の続きは、自分で書き直した' WHERE id = 'c2'");
    await migrate(db);
    const repo = createRepository(db);

    const c1 = await repo.getCard("c1");
    expect(c1?.examples.map((e) => e.text)).toEqual(["A（直した）", "B.", "C.", "D.", "E."]);
    expect(c1?.examples[4].translation).toBe("訳E");
    expect(c1?.note).toBe("覚え方"); // 移した「例文の続き」だけが消える

    // メモが書き換えられていたら、メモには触らず、例文にも足さない（二重にならない）
    const c2 = await repo.getCard("c2");
    expect(c2?.examples.map((e) => e.text)).toEqual(["P.", "Q.", "R."]);
    expect(c2?.note).toBe("例文の続きは、自分で書き直した");
  });

  it("もう一度 migrate しても、変わらない（二重に整形しない）", async () => {
    const { db, repo } = await oldDb([["c1", "basic", "concern", "①A.\n②B.", "①訳A\n②訳B"]]);
    await migrate(db);
    expect((await repo.getCard("c1"))?.examples).toHaveLength(2);
  });
});

describe("同梱の問題（ing or to）の例文", () => {
  it("例文の表に入り、内容が変わって入れ直すと、古い例文は残らない。自分の単語の例文には触れない", async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    const deck = await repo.createDeck("テスト");
    const mine = await repo.addCard(deck.id, { term: "mine", meaning: "私の", examples: [{ text: "My own.", translation: "私の。" }] });

    await syncPresets(db, { version: "v1", tips: [], ingOrTo: [{ id: "ingOrTo:avoid", term: "avoid", answer: "ing", example: "Please avoid making noise.（騒ぐのを避けてください）" }] });
    expect((await repo.listIngOrToCards()).map((c) => [c.term, c.examples.map((e) => e.text)])).toEqual([["avoid", ["Please avoid making noise.（騒ぐのを避けてください）"]]]);

    await syncPresets(db, { version: "v2", tips: [], ingOrTo: [{ id: "ingOrTo:avoid", term: "avoid", answer: "ing", example: "Avoid it." }, { id: "ingOrTo:enjoy", term: "enjoy", answer: "ing" }] });
    expect((await repo.listIngOrToCards()).map((c) => [c.term, c.examples.map((e) => e.text)])).toEqual([["avoid", ["Avoid it."]], ["enjoy", []]]);
    expect(await db.getAllAsync("SELECT text FROM card_examples WHERE card_id = 'ingOrTo:avoid'")).toEqual([{ text: "Avoid it." }]);
    expect((await repo.getCard(mine.id))?.examples).toEqual([{ text: "My own.", translation: "私の。" }]);
  });

  it("移行で、すでにある問題の例文も、例文の表に移る", async () => {
    const db = await createTestDb();
    await migrate(db, 3);
    await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES ('p', 'ing or to', 'preset', 1, 1)");
    await db.runAsync(
      "INSERT INTO cards (id, deck_id, type, term, meaning, example, answer, position, created_at, updated_at) VALUES ('i1', 'p', 'ing_or_to', 'avoid', '避ける', 'Please avoid it.', 'ing', 0, 1, 1)"
    );
    await migrate(db);
    expect((await createRepository(db).getCard("i1"))?.examples).toEqual([{ text: "Please avoid it.", translation: "" }]);
  });
});
