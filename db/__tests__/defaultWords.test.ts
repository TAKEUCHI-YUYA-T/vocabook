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

  it("スラング・ネット用語・会話でしか使わない言い回しは、入っていない（scripts/build-default-words.js の SLANG と同じ一覧）", () => {
    const banned = [
      "can't unsee", "bold of you to assume…", "and stuff", "get in the zone", "swing by", "just curious", "how come", "we'll see", "sort of", "nod off",
      "strike it rich", "sneak a peek at…", "full on", "higher-up", "something tells me…", "know enough to be dangerous", "dream co-star", "coed",
    ];
    const terms = new Set(words.map((w) => w.term.toLowerCase().replace(/[’‘]/g, "'")));
    expect(banned.filter((term) => terms.has(term))).toEqual([]);
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

describe("初回起動", () => {
  it("新規インストールは、既定の単語を入れず、空の単語帳から始まる（既定の単語は、「既定の単語を追加」で、利用者が選んで追加する）", async () => {
    const db = await createTestDb();
    await migrate(db);
    await ensureDefaultDeck(db);
    const repo = createRepository(db);
    expect((await repo.listDecks()).map((d) => d.cardCount)).toEqual([0]);
    expect((await repo.homeStats("2026-10-23")).total).toBe(0);
  });

  it("二度目の起動では、単語帳を増やさない。自分の単語帳がすでにあれば、作らない", async () => {
    const db = await createTestDb();
    await migrate(db);
    await ensureDefaultDeck(db);
    await ensureDefaultDeck(db);
    const repo = createRepository(db);
    expect(await repo.listDecks()).toHaveLength(1);

    const other = await createTestDb();
    await migrate(other);
    const otherRepo = createRepository(other);
    await otherRepo.createDeck("既存");
    await ensureDefaultDeck(other);
    expect((await otherRepo.listDecks()).map((d) => d.name)).toEqual(["既存"]);
  });
});
