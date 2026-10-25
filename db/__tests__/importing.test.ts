import { buildPreview, cardsToCsv, detectColumns, exportFileName, IMPORT_LIMITS, parseFlag, parseIngOrTo, parsePartOfSpeech, parseTable } from "../importing";
import { migrate } from "../migrations";
import { createRepository } from "../repository";
import { createTestDb } from "../testing/testDb";

const preview = (text: string, existing: { term: string; meaning: string }[] = []) => {
  const { rows } = parseTable(text);
  const { mapping, hasHeader } = detectColumns(rows);
  return buildPreview(rows, mapping, hasHeader, existing);
};

describe("表への分解", () => {
  it("タブ区切り（スプレッドシートからの貼り付け）を読む", () => {
    const { rows, delimiter } = parseTable("単語\t意味\napple\tりんご\nbanana\tバナナ");
    expect(delimiter).toBe("\t");
    expect(rows).toEqual([["単語", "意味"], ["apple", "りんご"], ["banana", "バナナ"]]);
  });

  it("カンマ区切りで、引用符の中のカンマや改行・引用符を、そのまま読む", () => {
    const text = '単語,意味,例文\r\nabolish,"廃止する、撤廃する","He said ""stop"".\nThen left."\r\n';
    const { rows } = parseTable(text);
    expect(rows[1]).toEqual(["abolish", "廃止する、撤廃する", 'He said "stop".\nThen left.']);
  });

  it("先頭の BOM と、空行を無視する", () => {
    const { rows } = parseTable("﻿単語,意味\n\napple,りんご\n   \n");
    expect(rows).toEqual([["単語", "意味"], ["apple", "りんご"]]);
  });

  it("大きすぎる入力は拒否し、行数の上限を超えたら切り捨てて知らせる", () => {
    expect(() => parseTable("a,b\n".repeat(IMPORT_LIMITS.maxBytes))).toThrow("大きすぎます");
    const many = "単語,意味\n" + Array.from({ length: IMPORT_LIMITS.maxRows + 10 }, (_, i) => `w${i},m${i}`).join("\n");
    const result = parseTable(many);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(IMPORT_LIMITS.maxRows + 1);
  });
});

describe("列の対応付け", () => {
  it("見出し名で見つけるので、列の順番が違っても、列が増えても動く", () => {
    const { mapping, hasHeader } = detectColumns([["メモ", "余計な列", "意味", "Word", "品詞"]]);
    expect(hasHeader).toBe(true);
    expect(mapping).toEqual({ note: 0, meaning: 2, term: 3, partOfSpeech: 4 });
  });

  it("元のシートの見出し（words / meaning / example / 空欄 / supplement）でも、必須の2列は見つかる", () => {
    const { mapping, hasHeader } = detectColumns([["words", "meaning", "example", "", "supplement"]]);
    expect(hasHeader).toBe(true);
    expect(mapping).toMatchObject({ term: 0, meaning: 1, example: 2, note: 4 });
    expect(mapping.exampleTranslation).toBeUndefined(); // 見出しが空欄の列は、推測せず、画面で選んでもらう
  });

  it("見出しがなければ、1行目もデータとし、1列目を単語・2列目を意味にする", () => {
    const { mapping, hasHeader } = detectColumns([["apple", "りんご", "I ate an apple.", "りんごを食べた"]]);
    expect(hasHeader).toBe(false);
    expect(mapping).toEqual({ term: 0, meaning: 1, example: 2, exampleTranslation: 3 });
  });
});

describe("品詞の読み取り", () => {
  it("日本語・英語・短縮形を受け付け、分からなければ null", () => {
    expect(parsePartOfSpeech("名詞")).toBe("noun");
    expect(parsePartOfSpeech(" Verb ")).toBe("verb");
    expect(parsePartOfSpeech("adj")).toBe("adjective");
    expect(parsePartOfSpeech("auxiliary verb")).toBe("auxiliaryVerb");
    expect(parsePartOfSpeech("イディオム")).toBe("idiom");
    expect(parsePartOfSpeech("???")).toBeNull();
    expect(parsePartOfSpeech("")).toBeNull();
  });
});

describe("プレビュー（行ごとの検証）", () => {
  it("不正な行だけを理由つきで除き、ほかの行は取り込める。行番号は見出し行を含む", () => {
    const result = preview("単語,意味,品詞\napple,りんご,名詞\n,空の単語,名詞\ncarrot,にんじん,謎の品詞");
    expect(result.totalRows).toBe(3);
    expect(result.valid.map((v) => v.input.term)).toEqual(["apple", "carrot"]);
    expect(result.errors).toEqual([{ rowNumber: 3, message: "単語を入力してください" }]);
  });

  it("意味が空の行も取り込む（単語だけ先に控えて、意味はあとで書けるように）", () => {
    const result = preview("単語,意味\napple,りんご\nbanana,\n");
    expect(result.errors).toEqual([]);
    expect(result.valid.map((v) => [v.input.term, v.input.meaning])).toEqual([["apple", "りんご"], ["banana", ""]]);
  });

  it("分からない品詞は、捨てずにメモへ残す", () => {
    const result = preview("単語,意味,品詞,メモ\ncarrot,にんじん,謎の品詞,既存のメモ");
    expect(result.valid[0].input).toMatchObject({ partOfSpeech: null, note: "既存のメモ\n品詞: 謎の品詞" });
  });

  it("取り込み内の重複と、単語帳にすでにある同じ単語・同じ意味は、取り込まない", () => {
    const result = preview("単語,意味\napple,りんご\nApple,りんご\napple,アップル\npear,梨", [{ term: "pear", meaning: "梨" }]);
    expect(result.valid.map((v) => v.input.term + ":" + v.input.meaning)).toEqual(["apple:りんご", "apple:アップル"]);
    expect(result.skippedDuplicates).toBe(2);
  });

  it("同じ単語でも意味が違えば取り込み、件数で知らせる", () => {
    const result = preview("単語,意味\npresent,贈り物", [{ term: "present", meaning: "現在" }]);
    expect(result.valid).toHaveLength(1);
    expect(result.sameTermDifferentMeaning).toBe(1);
  });

  it("必須の列が決まっていなければ、何も取り込まない", () => {
    expect(buildPreview([["a", "b"]], { term: 0 }, false)).toMatchObject({ valid: [], errors: [], totalRows: 0 });
  });

  it("長すぎる値は、その行だけエラーにする", () => {
    const result = preview(`単語,意味\n${"x".repeat(201)},長い\nok,大丈夫`);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("200文字以内");
    expect(result.valid).toHaveLength(1);
  });
});

describe("書き込みと書き出し", () => {
  const setup = async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    const deck = await repo.createDeck("取り込み先");
    return { db, repo, deck };
  };

  it("検証済みの行を、まとめて書き込む（50行の区切りをまたいでも、順番どおり）", async () => {
    const { repo, deck } = await setup();
    const inputs = Array.from({ length: 120 }, (_, i) => ({ term: `w${i}`, meaning: `意味${i}`, partOfSpeech: i % 2 ? ("noun" as const) : null }));
    expect(await repo.importCards(deck.id, inputs)).toBe(120);
    const cards = await repo.listCards(deck.id);
    expect(cards).toHaveLength(120);
    expect(cards.map((c) => c.term)).toEqual(inputs.map((i) => i.term));
    expect(cards[1].partOfSpeech).toBe("noun");

    // 続けて取り込んでも、順番は後ろに続く
    await repo.importCards(deck.id, [{ term: "last", meaning: "最後" }]);
    expect((await repo.listCards(deck.id)).at(-1)?.term).toBe("last");
  });

  it("1件でも不正があれば、何も書き込まない", async () => {
    const { repo, deck } = await setup();
    await expect(repo.importCards(deck.id, [{ term: "ok", meaning: "良い" }, { term: "", meaning: "不正" }])).rejects.toThrow("単語を入力してください");
    expect(await repo.listCards(deck.id)).toHaveLength(0);
  });

  it("意味が空でも書き込めるが、手入力の追加では意味が必須のまま。編集は、すでに意味が空の単語だけ空で保存できる", async () => {
    const { repo, deck } = await setup();
    expect(await repo.importCards(deck.id, [{ term: "void", meaning: "" }])).toBe(1);
    await expect(repo.addCard(deck.id, { term: "manual", meaning: "" })).rejects.toThrow("意味を入力してください");

    const [empty] = await repo.listCards(deck.id);
    const edited = await repo.updateCard(empty.id, { term: "void", meaning: "", examples: [{ text: "The contract is void.", translation: "" }] });
    expect(edited).toMatchObject({ meaning: "", examples: [{ text: "The contract is void.", translation: "" }] });

    const filled = await repo.addCard(deck.id, { term: "full", meaning: "満ちた" });
    await expect(repo.updateCard(filled.id, { term: "full", meaning: "" })).rejects.toThrow("意味を入力してください");
  });

  it("書き出した CSV を取り込み直すと、同じ内容に戻る（数式のように見える値も含めて）", async () => {
    const { repo, deck } = await setup();
    await repo.importCards(deck.id, [
      { term: "-ing", meaning: "=動名詞の語尾", partOfSpeech: "idiom", examples: [{ text: "He said \"stop\", then left.", translation: "「止まれ」と言って去った" }], note: "+メモ" },
      { term: "apple", meaning: "りんご" },
      {
        term: "concern",
        meaning: "心配",
        examples: [
          { text: "I have a concern.", translation: "懸念がある。" },
          { text: "Our chief concern is the weather.", translation: "" },
          { text: "It is of no concern to me.", translation: "私には関係ない。" },
        ],
      },
    ]);
    const csv = cardsToCsv(await repo.listCards(deck.id));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'-ing"); // Excel で数式にならないよう、先頭に ' が付く

    const again = preview(csv);
    expect(again.errors).toEqual([]);
    expect(again.valid.map((v) => v.input)).toEqual([
      { term: "-ing", meaning: "=動名詞の語尾", partOfSpeech: "idiom", examples: [{ text: "He said \"stop\", then left.", translation: "「止まれ」と言って去った" }], note: "+メモ", answer: null, flag: "" },
      { term: "apple", meaning: "りんご", partOfSpeech: null, examples: [], note: "", answer: null, flag: "" },
      {
        term: "concern",
        meaning: "心配",
        partOfSpeech: null,
        examples: [
          { text: "I have a concern.", translation: "懸念がある。" },
          { text: "Our chief concern is the weather.", translation: "" },
          { text: "It is of no concern to me.", translation: "私には関係ない。" },
        ],
        note: "",
        answer: null,
        flag: "",
      },
    ]);
  });

  it("ing or to の答えも書き出し、取り込み直すと同じ答えに戻る", async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    const deck = await repo.createDeck("テスト");
    await repo.importCards(deck.id, [
      { term: "avoid", meaning: "避ける", partOfSpeech: "verb", answer: "ing" },
      { term: "decide", meaning: "決める", partOfSpeech: "verb", answer: "to" },
      { term: "apple", meaning: "りんご" },
    ]);
    const csv = cardsToCsv(await repo.listCards(deck.id));
    expect(csv.split("\r\n")[0]).toBe("﻿単語,意味,品詞,例文,例文の訳,メモ,ing or to,フラグ");
    expect(preview(csv).valid.map((v) => [v.input.term, v.input.answer])).toEqual([
      ["avoid", "ing"],
      ["decide", "to"],
      ["apple", null],
    ]);
  });
});

describe("フラグの列", () => {
  it("「覚えた」「要復習」のほか、英語や短い言い方も、フラグとして読む", () => {
    expect(["覚えた", "learned", "済み", " 覚えた "].map(parseFlag)).toEqual(["learned", "learned", "learned", "learned"]);
    expect(["要復習", "review", "復習", "あやしい"].map(parseFlag)).toEqual(["review", "review", "review", "review"]);
    expect(["", "  ", "未学習", "???"].map(parseFlag)).toEqual([null, null, null, null]);
  });

  it("フラグも書き出して、取り込み直すと同じフラグに戻る。分からない文字は、メモに残す", async () => {
    const db = await createTestDb();
    await migrate(db);
    const repo = createRepository(db);
    const deck = await repo.createDeck("テスト");
    await repo.importCards(deck.id, [
      { term: "a", meaning: "あ", flag: "learned" },
      { term: "b", meaning: "い", flag: "review" },
      { term: "c", meaning: "う" },
    ]);
    const csv = cardsToCsv(await repo.listCards(deck.id));
    expect(preview(csv).valid.map((v) => [v.input.term, v.input.flag])).toEqual([
      ["a", "learned"],
      ["b", "review"],
      ["c", ""],
    ]);
    const odd = preview("単語,意味,フラグ\nx,え,未学習");
    expect(odd.valid[0].input).toMatchObject({ flag: "", note: "フラグ: 未学習" });
  });
});

describe("ing or to の列", () => {
  it("シートの ingOrTo タブの見出し（words / ing or to / meaning / example / 空欄 / supplement）から、答えの列を見つける", () => {
    const { mapping, hasHeader } = detectColumns([["words", "ing or to", "meaning", "example", "", "supplement"]]);
    expect(hasHeader).toBe(true);
    expect(mapping).toMatchObject({ term: 0, answer: 1, meaning: 2, example: 3, note: 5 });
  });

  it("「～ing」「to～」のほか、ing / to / 動名詞 / 不定詞 も答えとして読む", () => {
    expect(["～ing", "ing", "-ing", "動名詞"].map(parseIngOrTo)).toEqual(["ing", "ing", "ing", "ing"]);
    expect(["to～", "to", "to do", "不定詞"].map(parseIngOrTo)).toEqual(["to", "to", "to", "to"]);
    expect(["", "  ", "stop", "両方"].map(parseIngOrTo)).toEqual([null, null, null, null]);
  });

  it("分からない答えの文字は、捨てずにメモへ残す", () => {
    const result = preview("単語,意味,ing or to\nbegin,始める,両方\navoid,避ける,～ing");
    expect(result.valid.map((v) => [v.input.term, v.input.answer, v.input.note])).toEqual([
      ["begin", null, "ing or to: 両方"],
      ["avoid", "ing", ""],
    ]);
  });
});

describe("書き出しのファイル名", () => {
  it("ファイル名に使えない文字を取り除き、空なら既定の名前にする", () => {
    expect(exportFileName("マイ単語帳")).toBe("マイ単語帳.csv");
    expect(exportFileName(String.raw`a/b\c:d*e?f"g<h>i|j`)).toBe("a_b_c_d_e_f_g_h_i_j.csv");
    expect(exportFileName("../../etc/passwd")).toBe(".._.._etc_passwd.csv");
    expect(exportFileName("   ")).toBe("vocabook.csv");
    expect(exportFileName("x".repeat(100))).toBe(`${"x".repeat(40)}.csv`);
  });
});
