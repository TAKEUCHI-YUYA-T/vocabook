import { applyDataFixes, DATA_FIX_BACKUP_KEY, DATA_FIX_KEY } from "../dataFixes";
import { migrate } from "../migrations";
import { ensureDefaultDeck } from "../presets";
import { createRepository } from "../repository";
import { createTestDb } from "../testing/testDb";
import type { CardInput } from "../types";

const setup = async (inputs: CardInput[]) => {
  const db = await createTestDb();
  await migrate(db);
  await ensureDefaultDeck(db);
  const repo = createRepository(db);
  const deck = await repo.getDefaultDeck();
  await repo.importCards(deck.id, inputs);
  const terms = async () => (await repo.listCards(deck.id)).map((c) => `${c.term}/${c.partOfSpeech}/${c.meaning}`).sort();
  return { db, repo, deck, terms };
};

// 開発者の端末と同じ綴りミスを含む、作り物のデータ（意味は仮のもの）
const typical: CardInput[] = [
  { term: "beverge", meaning: "飲", partOfSpeech: "noun" },
  { term: "inducetry", meaning: "産", partOfSpeech: "noun" },
  { term: "tranceportation", meaning: "輸", partOfSpeech: "noun" },
  { term: "lamdscaing", meaning: "造", partOfSpeech: "noun" },
  { term: "ocasion", meaning: "機", partOfSpeech: "noun" },
  { term: "neverthless", meaning: "しかし", partOfSpeech: "conjunction", example: "Neverthless, he went. neverthlessly" },
  { term: "streamling", meaning: "合", partOfSpeech: "noun" },
  { term: "streamlining", meaning: "合", partOfSpeech: "noun" },
  { term: "exective", meaning: "重", partOfSpeech: "noun" },
  { term: "executive", meaning: "役", partOfSpeech: "noun" },
  { term: "paid", meaning: "給", partOfSpeech: "noun", example: "I was paid." },
  { term: "anxious", meaning: "心", partOfSpeech: "verb" },
  { term: "keep", meaning: "保つ", partOfSpeech: "verb" },
];

describe("一度だけの単語データの修正", () => {
  it("綴り・品詞を直し、重複を削除し、意味を統合する。ほかの単語には触れない", async () => {
    const { db, repo, deck, terms } = await setup(typical);
    const summary = await applyDataFixes(db);
    expect(summary?.status).toBe("applied");
    expect(await terms()).toEqual(
      [
        "beverage/noun/飲", "industry/noun/産", "transportation/noun/輸", "landscaping/noun/造", "occasion/noun/機",
        "nevertheless/conjunction/しかし", "streamlining/noun/合", "executive/noun/役、重", "pay/noun/給", "anxious/adjective/心", "keep/verb/保つ",
      ].sort()
    );
    const cards = await repo.listCards(deck.id);
    // 綴りミスの修正では、同じ行の例文の綴りミスも直す（大文字で始まる語は大文字のまま。語の一部は直さない）。語形の変更（paid → pay）では、例文は変えない
    expect(cards.find((c) => c.term === "nevertheless")?.example).toBe("Nevertheless, he went. neverthlessly");
    expect(cards.find((c) => c.term === "pay")?.example).toBe("I was paid.");
  });

  it("直す前の行を控えとして残し、二度目は何もしない", async () => {
    const { db } = await setup(typical);
    await applyDataFixes(db);
    const backup = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [DATA_FIX_BACKUP_KEY]);
    const rows = JSON.parse(backup?.value ?? "[]") as { term: string }[];
    expect(rows.map((r) => r.term)).toEqual(expect.arrayContaining(["beverge", "paid", "anxious", "streamling", "exective", "executive"]));
    expect(await applyDataFixes(db)).toBeNull();
  });

  it("開発者の端末のデータでなければ（綴りミスの語が少なければ）、何もしない", async () => {
    const { db, terms } = await setup([
      { term: "paid", meaning: "給", partOfSpeech: "noun" },
      { term: "anxious", meaning: "心", partOfSpeech: "verb" },
      { term: "beverge", meaning: "飲", partOfSpeech: "noun" },
    ]);
    const before = await terms();
    expect((await applyDataFixes(db))?.status).toBe("not-applicable");
    expect(await terms()).toEqual(before);
    const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [DATA_FIX_KEY]);
    expect(done).not.toBeNull();
  });

  it("対象が複数ある・品詞が違う・意味が違う重複は、飛ばして記録する", async () => {
    const { db, terms } = await setup([
      ...typical.filter((c) => !["anxious", "streamling"].includes(c.term)),
      { term: "anxious", meaning: "心1", partOfSpeech: "verb" },
      { term: "anxious", meaning: "心2", partOfSpeech: "verb" },
      { term: "streamling", meaning: "別の意味", partOfSpeech: "noun" },
      { term: "defective", meaning: "欠", partOfSpeech: "adjective" },
    ]);
    const summary = await applyDataFixes(db);
    expect(summary?.skipped).toEqual(
      expect.arrayContaining([expect.stringContaining("anxious（verb）: 対象が 2 件"), expect.stringContaining("defective（adverb）: 対象が 0 件"), "streamling: 正しい行と意味が違う"])
    );
    expect(await terms()).toEqual(expect.arrayContaining(["anxious/verb/心1", "anxious/verb/心2", "streamling/noun/別の意味", "defective/adjective/欠"]));
  });
});
