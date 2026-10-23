import fs from "fs";
import path from "path";
import { buildPosDictionary, type PosDictionaryData } from "../partOfSpeech";
import { ensureDefaultDeck, type DefaultWord } from "../presets";
import { migrate } from "../migrations";
import { createRepository } from "../repository";
import { spellingProblems } from "../spelling";
import { createTestDb } from "../testing/testDb";
import { PARTS_OF_SPEECH } from "../types";

// scripts/ は、Node で動かす JavaScript（型なし）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseEntries } = require("../../scripts/markdown-data");

const ROOT = path.join(__dirname, "..", "..");
const words: DefaultWord[] = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "presets", "default-words.json"), "utf8"));

describe("既定の単語（presets-src/default-words → assets/presets/default-words.json）", () => {
  it("Markdown と JSON が一致する（違うときは node scripts/build-presets.js を実行する）", () => {
    const labels = { 意味: "meaning", 例文: "example", 例文の訳: "exampleTranslation", メモ: "note" };
    const fromMarkdown = PARTS_OF_SPEECH.flatMap((pos) => {
      const file = path.join(ROOT, "presets-src", "default-words", `${pos.key}.md`);
      if (!fs.existsSync(file)) return [];
      return parseEntries(fs.readFileSync(file, "utf8"), labels).map((e: Record<string, string>) =>
        JSON.parse(JSON.stringify({ term: e.term, meaning: e.meaning, partOfSpeech: pos.key, example: e.example, exampleTranslation: e.exampleTranslation, note: e.note }))
      );
    });
    expect(fromMarkdown).toEqual(words);
  });

  it("すべての品詞に、単語がある。公開して配るので、まとまった数がある", () => {
    for (const pos of PARTS_OF_SPEECH) expect(words.filter((w) => w.partOfSpeech === pos.key).length).toBeGreaterThan(0);
    expect(words.length).toBeGreaterThanOrEqual(500);
  });

  it("品質: 単語と意味は必ずある。品詞は正しい。同じ単語・同じ品詞の重複がない。品詞名そのものの単語がない", () => {
    const keys = new Set<string>();
    for (const word of words) {
      expect(word.term.trim()).not.toBe("");
      expect(word.meaning.trim()).not.toBe("");
      expect(PARTS_OF_SPEECH.some((p) => p.key === word.partOfSpeech)).toBe(true);
      const key = `${word.term.toLowerCase()}|${word.partOfSpeech}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      expect(["noun", "verb", "adverb", "adjective", "preposition", "conjunction", "idiom"]).not.toContain(word.term.toLowerCase());
    }
  });

  it("品質: 単語に綴りミスの疑い（辞書にない語）がない。例文の訳が、例文なしに入っていない。メモは長すぎない", () => {
    const data: PosDictionaryData = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "dictionary", "pos.json"), "utf8"));
    const dictionary = buildPosDictionary(data);
    const suspicious = words.filter((w) => spellingProblems(w.term, dictionary).length > 0).map((w) => w.term);
    expect(suspicious).toEqual([]);
    expect(words.filter((w) => w.exampleTranslation && !w.example).map((w) => w.term)).toEqual([]);
    expect(words.filter((w) => (w.note ?? "").length > 150).map((w) => w.term)).toEqual([]);
  });
});

describe("初回起動での、既定の単語の入れ方", () => {
  const sample: DefaultWord[] = [
    { term: "abolish", meaning: "廃止する", partOfSpeech: "verb", example: "abolish slavery", exampleTranslation: "奴隷制度を廃止する" },
    { term: "benefit", meaning: "利益", partOfSpeech: "noun", note: "メモ" },
  ];
  const setup = async () => {
    const db = await createTestDb();
    await migrate(db);
    return { db, repo: createRepository(db) };
  };

  it("初回に、単語帳を作って、既定の単語を入れる（ふつうの単語として、編集・フラグができる）", async () => {
    const { db, repo } = await setup();
    await ensureDefaultDeck(db, sample);
    const deck = await repo.getDefaultDeck();
    const cards = await repo.listCards(deck.id);
    expect(cards.map((c) => [c.term, c.partOfSpeech, c.meaning, c.example, c.exampleTranslation, c.note, c.type, c.flag])).toEqual([
      ["abolish", "verb", "廃止する", "abolish slavery", "奴隷制度を廃止する", "", "basic", ""],
      ["benefit", "noun", "利益", "", "", "メモ", "basic", ""],
    ]);
    await repo.updateCard(cards[0].id, { term: "abolish", meaning: "撤廃する", flag: "learned" });
    expect((await repo.getCard(cards[0].id))?.flag).toBe("learned");
  });

  it("二度目の起動や、ユーザーが単語を削除したあとは、入れ直さない", async () => {
    const { db, repo } = await setup();
    await ensureDefaultDeck(db, sample);
    await ensureDefaultDeck(db, sample);
    const deck = await repo.getDefaultDeck();
    expect(await repo.listCards(deck.id)).toHaveLength(2);
    for (const card of await repo.listCards(deck.id)) await repo.deleteCard(card.id);
    await ensureDefaultDeck(db, sample);
    expect(await repo.listCards(deck.id)).toHaveLength(0);
  });

  it("すでに自分の単語帳がある場合（古い版から更新した場合）は、何も追加しない", async () => {
    const { db, repo } = await setup();
    const existing = await repo.createDeck("既存");
    await repo.addCard(existing.id, { term: "mine", meaning: "私の" });
    await ensureDefaultDeck(db, sample);
    expect((await repo.listDecks()).map((d) => [d.name, d.cardCount])).toEqual([["既存", 1]]);
  });

  it("既定の単語を渡さなければ（テストや開発）、空の単語帳を1つ作るだけ", async () => {
    const { db, repo } = await setup();
    await ensureDefaultDeck(db);
    expect((await repo.listDecks()).map((d) => d.cardCount)).toEqual([0]);
  });

  it("本物の既定の単語（800語台）も、1回の初回起動で、全部入る（品詞の数もそのまま）", async () => {
    const { db, repo } = await setup();
    await ensureDefaultDeck(db, words);
    const deck = await repo.getDefaultDeck();
    expect((await repo.listCards(deck.id)).length).toBe(words.length);
    const stats = await repo.homeStats("2026-10-23");
    expect(stats.total).toBe(words.length);
  });
});
