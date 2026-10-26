import { BackupError, exportBackup, getMeta, parseBackup, restoreBackup, setMeta, shouldAutoBackup, BACKUP_FORMAT } from "../backup";
import { migrate } from "../migrations";
import { ensureDefaultDeck, syncPresets } from "../presets";
import { createRepository } from "../repository";
import { createTestDb } from "../testing/testDb";

const setup = async () => {
  const db = await createTestDb();
  await migrate(db);
  await syncPresets(db, { version: "v1", tips: [], ingOrTo: [{ id: "ingOrTo:avoid", term: "avoid", answer: "ing", example: "Avoid it." }] });
  await ensureDefaultDeck(db);
  const repo = createRepository(db);
  const deck = await repo.getDefaultDeck();
  return { db, repo, deck };
};

describe("バックアップの書き出し", () => {
  it("自分の単語・例文・フラグ・学習の記録を含み、同梱のデータ（ing or to）・削除した単語は含まない", async () => {
    const { db, repo, deck } = await setup();
    const a = await repo.addCard(deck.id, { term: "concern", meaning: "関心事", partOfSpeech: "noun", examples: [{ text: "I have a concern.", translation: "懸念がある。" }, { text: "Two.", translation: "" }], note: "メモ", flag: "learned" });
    const gone = await repo.addCard(deck.id, { term: "gone", meaning: "消す" });
    await repo.deleteCard(gone.id);
    await repo.recordStudied(a.id, "2026-10-26");

    const backup = await exportBackup(db, new Date("2026-10-26T01:02:03Z"));
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: 1, exportedAt: "2026-10-26T01:02:03.000Z" });
    expect(backup.decks).toHaveLength(1);
    expect(backup.cards.map((c) => [c.term, c.flag, c.note, c.part_of_speech])).toEqual([["concern", "learned", "メモ", "noun"]]);
    expect(backup.examples.map((e) => [e.position, e.text])).toEqual([[0, "I have a concern."], [1, "Two."]]);
    expect(backup.studyLog).toEqual([{ day: "2026-10-26", card_id: a.id }]);
  });
});

describe("バックアップの読み取り（検証）", () => {
  const valid = () => ({
    format: BACKUP_FORMAT, version: 1, exportedAt: "x",
    decks: [{ id: "d1", name: "マイ単語帳", created_at: 1, updated_at: 1 }],
    cards: [{ id: "c1", deck_id: "d1", term: "a", meaning: "あ", part_of_speech: "noun", note: "", answer: "", position: 0, created_at: 1, updated_at: 1, flag: "", learned_day: null }],
    examples: [{ id: "e1", card_id: "c1", position: 0, text: "A.", translation: "あ。" }],
    studyLog: [{ day: "2026-10-26", card_id: "c1" }],
  });

  it("正しいファイルは読める。品詞・フラグ・答えの不正な値は、空にする", () => {
    const data = valid();
    (data.cards[0] as Record<string, unknown>).part_of_speech = "bogus";
    (data.cards[0] as Record<string, unknown>).flag = "x";
    (data.cards[0] as Record<string, unknown>).answer = "z";
    const parsed = parseBackup(JSON.stringify(data));
    expect(parsed.cards[0]).toMatchObject({ part_of_speech: null, flag: "", answer: "" });
  });

  it("バックアップではないファイル・壊れたファイル・新しすぎる版は、理由つきで断る", () => {
    expect(() => parseBackup("これは JSON ではない")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow("vocabook のバックアップのファイルではありません");
    expect(() => parseBackup(JSON.stringify({ ...valid(), version: 99 }))).toThrow("アプリを更新してください");
  });

  it("単語帳のない単語、単語のない例文、同じ ID の単語は、断る", () => {
    const orphanCard = valid();
    orphanCard.cards[0].deck_id = "nope";
    expect(() => parseBackup(JSON.stringify(orphanCard))).toThrow("単語帳のない単語");
    const orphanExample = valid();
    orphanExample.examples[0].card_id = "nope";
    expect(() => parseBackup(JSON.stringify(orphanExample))).toThrow("単語のない例文");
    const dup = valid();
    dup.cards.push({ ...dup.cards[0] });
    expect(() => parseBackup(JSON.stringify(dup))).toThrow("同じ ID");
  });
});

describe("復元", () => {
  it("書き出して、別の（空の）DB に復元すると、単語・例文・フラグ・学習の記録が同じに戻る。同梱のデータは残る", async () => {
    const source = await setup();
    const card = await source.repo.addCard(source.deck.id, {
      term: "deny", meaning: "否定する", partOfSpeech: "verb", answer: "ing", flag: "review",
      examples: [{ text: "He denied it.", translation: "彼は否定した。" }, { text: "She denied that.", translation: "" }],
    });
    await source.repo.setFlag(card.id, "learned", "2026-10-20");
    await source.repo.recordStudied(card.id, "2026-10-25");
    const file = JSON.stringify(await exportBackup(source.db));

    const target = await setup();
    await target.repo.addCard(target.deck.id, { term: "old", meaning: "古い" }); // 復元で、置き換えられる
    expect(await restoreBackup(target.db, parseBackup(file))).toBe(1);

    const decks = await target.repo.listDecks();
    expect(decks).toHaveLength(1);
    const cards = await target.repo.listCards(decks[0].id);
    expect(cards.map((c) => [c.term, c.flag, c.answer, c.partOfSpeech])).toEqual([["deny", "learned", "ing", "verb"]]);
    expect(cards[0].examples).toEqual([{ text: "He denied it.", translation: "彼は否定した。" }, { text: "She denied that.", translation: "" }]);
    // 学習した日の記録と、覚えた日（累計）が戻る
    expect(await target.repo.dailyStats(["2026-10-25"])).toEqual([{ day: "2026-10-25", studied: 1, learned: 1 }]);
    expect((await target.repo.dailyStats(["2026-10-19"]))[0].learned).toBe(0);
    expect((await target.repo.dailyStats(["2026-10-20"]))[0].learned).toBe(1);
    expect((await target.repo.listIngOrToCards()).filter((c) => c.type === "ing_or_to").map((c) => c.term)).toEqual(["avoid"]); // 同梱のデータは、そのまま
  });

  it("途中で失敗しても、元のデータは変わらない（1回のトランザクション）", async () => {
    const { db, repo, deck } = await setup();
    await repo.addCard(deck.id, { term: "keep", meaning: "残す" });
    const bad = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT, version: 1, exportedAt: "",
        decks: [{ id: "d1", name: "x", created_at: 1, updated_at: 1 }],
        cards: [
          { id: "c1", deck_id: "d1", term: "a", meaning: "あ", part_of_speech: null, note: "", answer: "", position: 0, created_at: 1, updated_at: 1, flag: "", learned_day: null },
        ],
        examples: [], studyLog: [],
      })
    );
    // 2つ目の単語帳を、同じ ID で入れようとして、失敗させる
    bad.decks.push({ id: "d1", name: "dup", created_at: 1, updated_at: 1 });
    await expect(restoreBackup(db, bad)).rejects.toThrow();
    expect((await repo.listCards(deck.id)).map((c) => c.term)).toEqual(["keep"]);
  });
});

describe("自動バックアップをする条件・保存先の記録", () => {
  const dayOf = (iso: string) => iso.slice(0, 10);

  it("保存先があり、今日まだなら、する。保存先がなければ、しない。今日もうしたなら、しない", () => {
    expect(shouldAutoBackup({ folder: null, lastAt: null, today: "2026-10-26", dayOf })).toBe(false);
    expect(shouldAutoBackup({ folder: "content://x", lastAt: null, today: "2026-10-26", dayOf })).toBe(true);
    expect(shouldAutoBackup({ folder: "content://x", lastAt: "2026-10-25T23:00:00Z", today: "2026-10-26", dayOf })).toBe(true);
    expect(shouldAutoBackup({ folder: "content://x", lastAt: "2026-10-26T01:00:00Z", today: "2026-10-26", dayOf })).toBe(false);
  });

  it("設定の値（meta 表）を、書いて・読んで・消せる", async () => {
    const { db } = await setup();
    expect(await getMeta(db, "backup_folder_uri")).toBeNull();
    await setMeta(db, "backup_folder_uri", "content://a");
    await setMeta(db, "backup_folder_uri", "content://b"); // 上書き
    expect(await getMeta(db, "backup_folder_uri")).toBe("content://b");
    await setMeta(db, "backup_folder_uri", null);
    expect(await getMeta(db, "backup_folder_uri")).toBeNull();
  });
});
