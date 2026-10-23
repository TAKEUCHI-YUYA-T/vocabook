import fs from "fs";
import path from "path";
import { defaultWordToInput, findMissingDefaultWords } from "../defaultWords";
import { migrate } from "../migrations";
import { ensureDefaultDeck, type DefaultWord } from "../presets";
import { createRepository } from "../repository";
import { createTestDb } from "../testing/testDb";

const words: DefaultWord[] = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "presets", "default-words.json"), "utf8"));

const sample: DefaultWord[] = [
  { term: "Abolish", meaning: "廃止する", partOfSpeech: "verb", example: "abolish slavery", exampleTranslation: "奴隷制度を廃止する", note: "メモ" },
  { term: "benefit", meaning: "利益", partOfSpeech: "noun" },
  { term: "benefit", meaning: "利益を得る", partOfSpeech: "verb" },
];

describe("既定の単語のうち、まだない単語（findMissingDefaultWords）", () => {
  it("同じ単語（大文字小文字は区別しない）・同じ品詞があれば、ない単語としない。品詞が違えば、ない単語", () => {
    const existing = [{ term: " abolish ", partOfSpeech: "verb" }, { term: "BENEFIT", partOfSpeech: "noun" }];
    expect(findMissingDefaultWords(existing, sample).map((w) => [w.term, w.partOfSpeech])).toEqual([["benefit", "verb"]]);
  });

  it("意味や例文は比べない（自分で直した単語を、重ねて追加しない）。何もなければ、すべてがない単語", () => {
    expect(findMissingDefaultWords([{ term: "abolish", partOfSpeech: "verb" }], [{ ...sample[0], meaning: "別の意味" }])).toEqual([]);
    expect(findMissingDefaultWords([], sample)).toHaveLength(3);
  });

  it("追加するときの入力は、空の項目を空文字にそろえる", () => {
    expect(defaultWordToInput(sample[1])).toEqual({ term: "benefit", meaning: "利益", partOfSpeech: "noun", example: "", exampleTranslation: "", note: "" });
  });
});

describe("単語帳への、既定の単語の追加", () => {
  it("ない単語だけを追加し、二度目は何も追加しない（削除した単語は、操作したときだけ戻る）", async () => {
    const db = await createTestDb();
    await migrate(db);
    await ensureDefaultDeck(db);
    const repo = createRepository(db);
    const deck = await repo.getDefaultDeck();
    await repo.addCard(deck.id, { term: "abolish", meaning: "自分の意味", partOfSpeech: "verb" });

    const add = async () => repo.importCards(deck.id, findMissingDefaultWords(await repo.listCards(deck.id), sample).map(defaultWordToInput));
    expect(await add()).toBe(2);
    expect(await add()).toBe(0);
    const cards = await repo.listCards(deck.id);
    expect(cards.map((c) => [c.term, c.partOfSpeech, c.meaning]).sort()).toEqual([
      ["abolish", "verb", "自分の意味"], // 自分の単語は、そのまま
      ["benefit", "noun", "利益"],
      ["benefit", "verb", "利益を得る"],
    ]);

    await repo.deleteCard(cards.find((c) => c.term === "benefit" && c.partOfSpeech === "noun")!.id);
    expect(await add()).toBe(1); // 削除した単語は、操作すると戻る
  });

  it("本物の既定の単語（863語台）は、空の単語帳に、全部追加できる。追加後は、追加できる単語がない", async () => {
    const db = await createTestDb();
    await migrate(db);
    await ensureDefaultDeck(db);
    const repo = createRepository(db);
    const deck = await repo.getDefaultDeck();
    const missing = findMissingDefaultWords(await repo.listCards(deck.id), words);
    expect(missing).toHaveLength(words.length);
    expect(await repo.importCards(deck.id, missing.map(defaultWordToInput))).toBe(words.length);
    expect(findMissingDefaultWords(await repo.listCards(deck.id), words)).toEqual([]);
  });
});
