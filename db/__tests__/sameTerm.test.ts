import { migrate } from "../migrations";
import { createRepository } from "../repository";
import { groupByTerm, oneCardPerTerm, otherPartsOfSpeech, sameTermCards, sortByPartOfSpeech, termKey } from "../sameTerm";
import { createTestDb } from "../testing/testDb";
import type { Card, PartOfSpeech } from "../types";

const card = (id: string, term: string, partOfSpeech: PartOfSpeech | null, meaning = `${id}の意味`, position = 0): Card => ({
  id, deckId: "d", type: "basic", term, meaning, partOfSpeech, examples: [], note: "", answer: "", flag: "", position, createdAt: 1, updatedAt: 1,
});

describe("同じ綴りの単語のまとめ方", () => {
  const verb = card("v", "dare", "verb");
  const adverb = card("a", "Dare ", "adverb");
  const aux = card("x", "dare", "auxiliaryVerb");
  const noun = card("n", "concern", "noun");

  it("綴りは、前後の空白と大文字小文字を区別しない。まとまりは、品詞の並び（名詞、動詞、副詞、…、助動詞）", () => {
    expect(termKey("  Dare ")).toBe("dare");
    const groups = groupByTerm([aux, adverb, verb, noun]);
    expect(groups.get("dare")?.map((c) => c.id)).toEqual(["v", "a", "x"]);
    expect(groups.get("concern")?.map((c) => c.id)).toEqual(["n"]);
  });

  it("同じ品詞の並びは、単語帳の並び（position、id）の順。品詞のない単語は、最後", () => {
    const sorted = sortByPartOfSpeech([card("n2", "x", "noun", "m", 5), card("none", "x", null), card("n1", "x", "noun", "m", 1)]);
    expect(sorted.map((c) => c.id)).toEqual(["n1", "n2", "none"]);
  });

  it("ほかの品詞は、いまの単語を除き、意味のある単語だけ。ほかになければ、空", () => {
    const groups = groupByTerm([verb, adverb, aux, card("e", "dare", "noun", "  ")]);
    expect(otherPartsOfSpeech(verb, groups).map((c) => c.id)).toEqual(["a", "x"]); // 意味が空の名詞は出さない
    expect(otherPartsOfSpeech(noun, groupByTerm([noun]))).toEqual([]);
    expect(sameTermCards(noun, new Map())).toEqual([noun]);
  });

  it("聞き取り用に、同じ綴りを1つにする。残すのは、品詞の並びで先頭の単語（いつも同じ）", () => {
    const one = oneCardPerTerm([aux, noun, adverb, verb]);
    expect(one.map((c) => c.id).sort()).toEqual(["n", "v"]);
    expect(oneCardPerTerm([verb, adverb, aux]).map((c) => c.id)).toEqual(["v"]);
    expect(oneCardPerTerm([aux, adverb, verb]).map((c) => c.id)).toEqual(["v"]);
  });
});

describe("同じ綴りの単語の取り出し（listCardsSharingTerm）", () => {
  it("同じ綴りが2つ以上ある単語だけを、例文つきで取り出す。削除した単語と、ほかの単語帳・ing or to は数えない", async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    const deck = await repo.createDeck("テスト");
    const other = await repo.createDeck("別の単語帳");
    await repo.addCard(deck.id, { term: "concern", meaning: "関心事", partOfSpeech: "noun", examples: [{ text: "I have a concern.", translation: "懸念がある。" }] });
    await repo.addCard(deck.id, { term: "Concern ", meaning: "関係している", partOfSpeech: "verb" });
    await repo.addCard(deck.id, { term: "alone", meaning: "ひとりで", partOfSpeech: "adverb" });
    const gone = await repo.addCard(deck.id, { term: "mail", meaning: "郵便", partOfSpeech: "noun" });
    await repo.addCard(deck.id, { term: "mail", meaning: "郵送する", partOfSpeech: "verb" });
    await repo.deleteCard(gone.id); // 削除すると、mail は1つだけになる
    await repo.addCard(other.id, { term: "alone", meaning: "別の単語帳の alone", partOfSpeech: "adjective" });

    const found = await repo.listCardsSharingTerm([deck.id]);
    expect(found.map((c) => c.meaning).sort()).toEqual(["関係している", "関心事"].sort());
    expect(found.find((c) => c.partOfSpeech === "noun")?.examples).toEqual([{ text: "I have a concern.", translation: "懸念がある。" }]);

    // 単語帳を2つとも指定すると、alone も同じ綴りになる
    const both = await repo.listCardsSharingTerm([deck.id, other.id]);
    expect(both.filter((c) => c.term.trim().toLowerCase() === "alone")).toHaveLength(2);
    expect(await repo.listCardsSharingTerm([])).toEqual([]);
  });
});
