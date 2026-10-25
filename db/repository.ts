import { newId, now, type Db, type SqlParam } from "./database";
import { compactExamples, MAX_EXAMPLES, type Example } from "./examples";
import { localDay } from "./day";
import { DEFAULT_DECK_NAME } from "./presets";
import type { Card, CardFlag, CardInput, CardType, Deck, DeckKind, DeckSummary, HomeStats, IngOrToAnswer, PartOfSpeech, StudyFilter, Tip } from "./types";
import { PARTS_OF_SPEECH, toFlag } from "./types";

/** 入力できる長さの上限。極端に長い値でアプリが重くならないようにする */
export const LIMITS = { term: 200, meaning: 1000, example: 2000, note: 2000, deckName: 100 } as const;
export { MAX_EXAMPLES };

export class ValidationError extends Error {}

type DeckRow = { id: string; name: string; kind: DeckKind; created_at: number; updated_at: number; card_count?: number };
type CardRow = {
  id: string; deck_id: string; type: CardType; term: string; meaning: string; part_of_speech: string | null;
  note: string; answer: string; position: number; created_at: number; updated_at: number; flag: string;
};

const toDeck = (row: DeckRow): Deck => ({ id: row.id, name: row.name, kind: row.kind, createdAt: row.created_at, updatedAt: row.updated_at });

const toCard = (row: CardRow, examples: Example[]): Card => ({
  id: row.id,
  deckId: row.deck_id,
  type: row.type,
  term: row.term,
  meaning: row.meaning,
  partOfSpeech: PARTS_OF_SPEECH.some((p) => p.key === row.part_of_speech) ? (row.part_of_speech as PartOfSpeech) : null,
  examples,
  note: row.note,
  answer: row.answer,
  flag: toFlag(row.flag),
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const CARD_COLUMNS = "id, deck_id, type, term, meaning, part_of_speech, note, answer, position, created_at, updated_at, flag";

/** INSERT の、1行ぶんの値の ? の並び（CARD_COLUMNS の並びと同じ。type は 'basic' 固定） */
const CARD_PLACEHOLDERS = "(?, ?, 'basic', ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/** 1回の SQL に入れる行数の目安（変数の数の上限に当たらないように、小さく分ける） */
const EXAMPLE_ROWS_PER_STATEMENT = 100;
const IDS_PER_QUERY = 500;

/** LIKE の特殊文字（% と _）を、ふつうの文字として検索するための処理 */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/** 入力値を検証し、前後の空白を取り除いた値を返す。不正なら ValidationError */
/**
 * 意味が空でもよいのは、取り込みと、すでに意味が空の単語の編集だけ（手入力の新規登録では必須）
 */
export type ValidateOptions = { allowEmptyMeaning?: boolean };

export function validateCardInput(
  input: CardInput,
  options: ValidateOptions = {}
): Required<Omit<CardInput, "partOfSpeech" | "answer" | "flag" | "examples">> & { examples: Example[]; partOfSpeech: PartOfSpeech | null; answer: IngOrToAnswer | null; flag: CardFlag | undefined } {
  const term = input.term.trim();
  const meaning = input.meaning.trim();
  const examples = compactExamples(input.examples);
  const note = (input.note ?? "").trim();

  if (!term) throw new ValidationError("単語を入力してください");
  if (!meaning && !options.allowEmptyMeaning) throw new ValidationError("意味を入力してください");
  if (term.length > LIMITS.term) throw new ValidationError(`単語は${LIMITS.term}文字以内で入力してください`);
  if (meaning.length > LIMITS.meaning) throw new ValidationError(`意味は${LIMITS.meaning}文字以内で入力してください`);
  if (examples.length > MAX_EXAMPLES) throw new ValidationError(`例文は${MAX_EXAMPLES}個までです`);
  if (examples.some((e) => e.text.length > LIMITS.example || e.translation.length > LIMITS.example)) {
    throw new ValidationError(`例文は${LIMITS.example}文字以内で入力してください`);
  }
  if (note.length > LIMITS.note) throw new ValidationError(`メモは${LIMITS.note}文字以内で入力してください`);

  const pos = input.partOfSpeech ?? null;
  if (pos !== null && !PARTS_OF_SPEECH.some((p) => p.key === pos)) throw new ValidationError("品詞が正しくありません");

  const answer = input.answer ?? null;
  if (answer !== null && answer !== "ing" && answer !== "to") throw new ValidationError("ing or to の答えが正しくありません");

  const flag = input.flag;
  if (flag !== undefined && flag !== "" && flag !== "learned" && flag !== "review") throw new ValidationError("フラグが正しくありません");

  return { term, meaning, examples, note, partOfSpeech: pos, answer, flag };
}

/** 単語帳・単語・ヒントの読み書きをまとめたもの。画面は DB を直接触らず、これを通す */
export function createRepository(db: Db) {
  const requireEditableDeck = async (deckId: string): Promise<Deck> => {
    const deck = await getDeck(deckId);
    if (!deck) throw new ValidationError("単語帳が見つかりません");
    if (deck.kind === "preset") throw new ValidationError("この単語帳は編集できません");
    return deck;
  };

  async function getDeck(id: string): Promise<Deck | null> {
    const row = await db.getFirstAsync<DeckRow>("SELECT id, name, kind, created_at, updated_at FROM decks WHERE id = ? AND deleted_at IS NULL", [id]);
    return row ? toDeck(row) : null;
  }

  /** 単語の例文を、まとめて読む（単語の id → 例文の並び） */
  async function loadExamples(cardIds: string[]): Promise<Map<string, Example[]>> {
    const map = new Map<string, Example[]>();
    for (let start = 0; start < cardIds.length; start += IDS_PER_QUERY) {
      const ids = cardIds.slice(start, start + IDS_PER_QUERY);
      const rows = await db.getAllAsync<{ card_id: string; text: string; translation: string }>(
        `SELECT card_id, text, translation FROM card_examples WHERE card_id IN (${ids.map(() => "?").join(", ")}) ORDER BY card_id, position`,
        ids
      );
      for (const row of rows) {
        const list = map.get(row.card_id) ?? [];
        list.push({ text: row.text, translation: row.translation });
        map.set(row.card_id, list);
      }
    }
    return map;
  }

  /** 単語の行を、例文つきの単語にする */
  async function withExamples(rows: CardRow[]): Promise<Card[]> {
    const examples = await loadExamples(rows.map((row) => row.id));
    return rows.map((row) => toCard(row, examples.get(row.id) ?? []));
  }

  /** 例文の行（[単語の id, 例文の並び]）を、まとめて書き込む。位置は、並びの順 */
  async function insertExamples(entries: { cardId: string; examples: Example[] }[]): Promise<void> {
    const rows: SqlParam[][] = entries.flatMap(({ cardId, examples }) =>
      examples.map((example, position): SqlParam[] => [newId(), cardId, position, example.text, example.translation])
    );
    for (let start = 0; start < rows.length; start += EXAMPLE_ROWS_PER_STATEMENT) {
      const chunk = rows.slice(start, start + EXAMPLE_ROWS_PER_STATEMENT);
      await db.runAsync(
        `INSERT INTO card_examples (id, card_id, position, text, translation) VALUES ${chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
        chunk.flat()
      );
    }
  }

  const repo = {
    getDeck,

    /**
     * 自分の単語帳の一覧（作った順）
     * ing or to のような同梱の読み取り専用データ（kind = 'preset'）は含めない
     */
    async listDecks(): Promise<DeckSummary[]> {
      const rows = await db.getAllAsync<DeckRow>(
        `SELECT d.id, d.name, d.kind, d.created_at, d.updated_at,
           (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id AND c.deleted_at IS NULL) AS card_count
         FROM decks d WHERE d.deleted_at IS NULL AND d.kind = 'user'
         ORDER BY d.created_at, d.id`
      );
      return rows.map((row) => ({ ...toDeck(row), cardCount: row.card_count ?? 0 }));
    },

    /**
     * 単語を入れる単語帳。画面では単語帳を1冊として扱うので、自分の単語帳の先頭（作った順）を返す
     * 1冊もなければ、空の単語帳を作る（DB の仕組みは複数の単語帳に対応したままなので、あとから画面を増やせる）
     */
    async getDefaultDeck(): Promise<Deck> {
      const row = await db.getFirstAsync<DeckRow>(
        "SELECT id, name, kind, created_at, updated_at FROM decks WHERE deleted_at IS NULL AND kind = 'user' ORDER BY created_at, id LIMIT 1"
      );
      return row ? toDeck(row) : repo.createDeck(DEFAULT_DECK_NAME);
    },

    async createDeck(name: string): Promise<Deck> {
      const trimmed = name.trim();
      if (!trimmed) throw new ValidationError("単語帳の名前を入力してください");
      if (trimmed.length > LIMITS.deckName) throw new ValidationError(`名前は${LIMITS.deckName}文字以内で入力してください`);
      const id = newId();
      const timestamp = now();
      await db.runAsync("INSERT INTO decks (id, name, kind, created_at, updated_at) VALUES (?, ?, 'user', ?, ?)", [id, trimmed, timestamp, timestamp]);
      return { id, name: trimmed, kind: "user", createdAt: timestamp, updatedAt: timestamp };
    },

    async renameDeck(id: string, name: string): Promise<void> {
      await requireEditableDeck(id);
      const trimmed = name.trim();
      if (!trimmed) throw new ValidationError("単語帳の名前を入力してください");
      if (trimmed.length > LIMITS.deckName) throw new ValidationError(`名前は${LIMITS.deckName}文字以内で入力してください`);
      await db.runAsync("UPDATE decks SET name = ?, updated_at = ? WHERE id = ?", [trimmed, now(), id]);
    },

    /** 単語帳を削除する（中の単語も一緒に論理削除） */
    async deleteDeck(id: string): Promise<void> {
      await requireEditableDeck(id);
      const timestamp = now();
      await db.withTransactionAsync(async () => {
        await db.runAsync("UPDATE cards SET deleted_at = ?, updated_at = ? WHERE deck_id = ? AND deleted_at IS NULL", [timestamp, timestamp, id]);
        await db.runAsync("UPDATE decks SET deleted_at = ?, updated_at = ? WHERE id = ?", [timestamp, timestamp, id]);
      });
    },

    /** 単語帳の単語を一覧する。query があれば、単語・意味・例文を部分一致で検索する */
    async listCards(deckId: string, query = ""): Promise<Card[]> {
      const params: SqlParam[] = [deckId];
      let where = "deck_id = ? AND deleted_at IS NULL";
      const trimmed = query.trim();
      if (trimmed) {
        where += " AND (term LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM card_examples e WHERE e.card_id = cards.id AND e.text LIKE ? ESCAPE '\\'))";
        const pattern = `%${escapeLike(trimmed)}%`;
        params.push(pattern, pattern, pattern);
      }
      const rows = await db.getAllAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE ${where} ORDER BY position, created_at`, params);
      return withExamples(rows);
    },

    async getCard(id: string): Promise<Card | null> {
      const row = await db.getFirstAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE id = ? AND deleted_at IS NULL`, [id]);
      return row ? (await withExamples([row]))[0] : null;
    },

    /** 同じ単語（大文字小文字を区別しない）がすでにあるか。追加時の重複警告に使う */
    async findDuplicates(deckId: string, term: string, excludeCardId?: string): Promise<Card[]> {
      const rows = await db.getAllAsync<CardRow>(
        `SELECT ${CARD_COLUMNS} FROM cards WHERE deck_id = ? AND deleted_at IS NULL AND LOWER(term) = LOWER(?) AND id <> ?`,
        [deckId, term.trim(), excludeCardId ?? ""]
      );
      return withExamples(rows);
    },

    async addCard(deckId: string, input: CardInput): Promise<Card> {
      await requireEditableDeck(deckId);
      const value = validateCardInput(input);
      const id = newId();
      const timestamp = now();
      const last = await db.getFirstAsync<{ max_position: number | null }>("SELECT MAX(position) AS max_position FROM cards WHERE deck_id = ?", [deckId]);
      const position = (last?.max_position ?? -1) + 1;
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO cards (${CARD_COLUMNS}) VALUES ${CARD_PLACEHOLDERS}`,
          [id, deckId, value.term, value.meaning, value.partOfSpeech, value.note, value.answer ?? "", position, timestamp, timestamp, value.flag ?? ""]
        );
        await insertExamples([{ cardId: id, examples: value.examples }]);
      });
      return (await repo.getCard(id)) as Card;
    },

    /**
     * 検証済みの単語を、まとめて追加する（取り込み用）
     * 1回のトランザクションで書き込むので、途中で失敗しても、半端な状態は残らない
     * 戻り値は、追加した件数
     */
    async importCards(deckId: string, inputs: CardInput[]): Promise<number> {
      await requireEditableDeck(deckId);
      if (inputs.length === 0) return 0;
      const values = inputs.map((input) => validateCardInput(input, { allowEmptyMeaning: true })); // 念のため、書き込む前にもう一度検証する
      const timestamp = now();
      await db.withTransactionAsync(async () => {
        const last = await db.getFirstAsync<{ max_position: number | null }>("SELECT MAX(position) AS max_position FROM cards WHERE deck_id = ?", [deckId]);
        let position = (last?.max_position ?? -1) + 1;
        const perStatement = 50;
        for (let start = 0; start < values.length; start += perStatement) {
          const chunk = values.slice(start, start + perStatement);
          const params: SqlParam[] = [];
          const entries: { cardId: string; examples: Example[] }[] = [];
          for (const value of chunk) {
            const id = newId();
            params.push(id, deckId, value.term, value.meaning, value.partOfSpeech, value.note, value.answer ?? "", position++, timestamp, timestamp, value.flag ?? "");
            entries.push({ cardId: id, examples: value.examples });
          }
          const placeholders = chunk.map(() => CARD_PLACEHOLDERS).join(", ");
          await db.runAsync(`INSERT INTO cards (${CARD_COLUMNS}) VALUES ${placeholders}`, params);
          await insertExamples(entries);
        }
      });
      return values.length;
    },

    async updateCard(id: string, input: CardInput): Promise<Card> {
      const existing = await repo.getCard(id);
      if (!existing) throw new ValidationError("単語が見つかりません");
      await requireEditableDeck(existing.deckId);
      const value = validateCardInput(input, { allowEmptyMeaning: existing.meaning === "" });
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE cards SET term = ?, meaning = ?, part_of_speech = ?, note = ?, answer = ?, flag = ?, updated_at = ? WHERE id = ?",
          [value.term, value.meaning, value.partOfSpeech, value.note, value.answer ?? "", value.flag ?? existing.flag, now(), id]
        );
        await db.runAsync("DELETE FROM card_examples WHERE card_id = ?", [id]);
        await insertExamples([{ cardId: id, examples: value.examples }]);
      });
      if (value.flag !== undefined && value.flag !== existing.flag) await repo.setFlag(id, value.flag);
      return (await repo.getCard(id)) as Card;
    },

    async deleteCard(id: string): Promise<void> {
      const existing = await repo.getCard(id);
      if (!existing) return;
      await requireEditableDeck(existing.deckId);
      const timestamp = now();
      await db.runAsync("UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?", [timestamp, timestamp, id]);
    },

    /** 出題用に、条件に合う単語（basic のみ）を取り出す。順番は呼び出し側でシャッフルする */
    async listStudyCards(filter: StudyFilter): Promise<Card[]> {
      if (filter.deckIds.length === 0) return [];
      const params: SqlParam[] = [...filter.deckIds];
      let where = `type = 'basic' AND deleted_at IS NULL AND deck_id IN (${filter.deckIds.map(() => "?").join(", ")})`;
      if (filter.partsOfSpeech && filter.partsOfSpeech.length > 0) {
        where += ` AND part_of_speech IN (${filter.partsOfSpeech.map(() => "?").join(", ")})`;
        params.push(...filter.partsOfSpeech);
      }
      if (filter.flags && filter.flags.length > 0) {
        where += ` AND flag IN (${filter.flags.map(() => "?").join(", ")})`;
        params.push(...filter.flags);
      }
      if (filter.requireMeaning) where += " AND meaning <> ''";
      const rows = await db.getAllAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE ${where}`, params);
      return withExamples(rows);
    },

    /**
     * 出題の絞り込み画面の集計。品詞とフラグの組み合わせごとの、単語の数（意味のある単語の数も）
     * 画面で、選んだ条件に合う数を、組み合わせから計算する（db/studyRange.ts）
     */
    async studyBreakdown(deckIds: string[]): Promise<{ partOfSpeech: string; flag: string; count: number; withMeaning: number }[]> {
      if (deckIds.length === 0) return [];
      const rows = await db.getAllAsync<{ part_of_speech: string | null; flag: string; n: number; with_meaning: number }>(
        `SELECT part_of_speech, flag, COUNT(*) AS n, SUM(CASE WHEN meaning <> '' THEN 1 ELSE 0 END) AS with_meaning
         FROM cards WHERE type = 'basic' AND deleted_at IS NULL AND deck_id IN (${deckIds.map(() => "?").join(", ")})
         GROUP BY part_of_speech, flag`,
        deckIds
      );
      return rows.map((row) => ({ partOfSpeech: row.part_of_speech ?? "", flag: row.flag, count: row.n, withMeaning: row.with_meaning ?? 0 }));
    },

    /**
     * 単語のフラグを付ける・外す（学習画面・編集画面から）
     * 「覚えた」にした日を記録する（すでに「覚えた」なら、最初の日のまま）。「覚えた」以外にしたら、日を消す
     */
    async setFlag(id: string, flag: CardFlag, day: string = localDay()): Promise<void> {
      const next = toFlag(flag);
      await db.runAsync(
        `UPDATE cards SET flag = ?, learned_day = CASE WHEN ? = 'learned' THEN COALESCE(CASE WHEN flag = 'learned' THEN learned_day END, ?) ELSE NULL END, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [next, next, day, now(), id]
      );
    },

    /**
     * グラフ用の、日ごとの数（days は古い順の日付）
     * - studied: その日に答えを見た単語の数（同じ単語は1回）
     * - learned: その日の終わりに「覚えた」だった単語の数（今「覚えた」の単語を、覚えた日で数える。あとで外した単語は数えない）
     */
    async dailyStats(days: string[]): Promise<{ day: string; studied: number; learned: number }[]> {
      if (days.length === 0) return [];
      const studied = await db.getAllAsync<{ day: string; n: number }>(
        `SELECT l.day AS day, COUNT(*) AS n FROM study_log l JOIN cards c ON c.id = l.card_id
         WHERE c.deleted_at IS NULL AND c.type = 'basic' AND l.day BETWEEN ? AND ? GROUP BY l.day`,
        [days[0], days[days.length - 1]]
      );
      const learned = await db.getAllAsync<{ day: string | null; n: number }>(
        `SELECT learned_day AS day, COUNT(*) AS n FROM cards WHERE flag = 'learned' AND deleted_at IS NULL AND type = 'basic' GROUP BY learned_day`
      );
      return buildDailySeries(days, studied, learned);
    },

    /** 単語の答えを見たことを記録する（day は "YYYY-MM-DD"。同じ日に同じ単語を何度見ても、1回と数える） */
    async recordStudied(cardId: string, day: string): Promise<void> {
      await db.runAsync("INSERT OR IGNORE INTO study_log (day, card_id) VALUES (?, ?)", [day, cardId]);
    },

    /** ホームに出す記録（今日見た単語の数、「覚えた」の数、単語の総数） */
    async homeStats(day: string): Promise<HomeStats> {
      const studied = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM study_log l JOIN cards c ON c.id = l.card_id WHERE l.day = ? AND c.deleted_at IS NULL AND c.type = 'basic'`,
        [day]
      );
      const cards = await db.getFirstAsync<{ total: number; learned: number }>(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN flag = 'learned' THEN 1 ELSE 0 END) AS learned
         FROM cards WHERE type = 'basic' AND deleted_at IS NULL`
      );
      return { studiedToday: studied?.n ?? 0, learned: cards?.learned ?? 0, total: cards?.total ?? 0 };
    },

    /** ing or to の問題（同梱の問題と、ing or to の答えを付けた自分の単語） */
    async listIngOrToCards(): Promise<Card[]> {
      const rows = await db.getAllAsync<CardRow>(
        `SELECT ${CARD_COLUMNS} FROM cards
         WHERE deleted_at IS NULL AND (type = 'ing_or_to' OR (type = 'basic' AND answer IN ('ing', 'to')))
         ORDER BY position`
      );
      return withExamples(rows);
    },

    /** 各品詞の単語数（出題の絞り込み画面に表示する） */
    async countByPartOfSpeech(deckIds: string[]): Promise<Record<string, number>> {
      if (deckIds.length === 0) return {};
      const rows = await db.getAllAsync<{ part_of_speech: string | null; n: number }>(
        `SELECT part_of_speech, COUNT(*) AS n FROM cards
         WHERE type = 'basic' AND deleted_at IS NULL AND deck_id IN (${deckIds.map(() => "?").join(", ")})
         GROUP BY part_of_speech`,
        deckIds
      );
      return Object.fromEntries(rows.map((row) => [row.part_of_speech ?? "", row.n]));
    },

    /** ホームに出すヒントを1件、ランダムに選ぶ */
    async randomTip(): Promise<Tip | null> {
      const row = await db.getFirstAsync<{ id: string; title: string; body: string; url: string }>("SELECT id, title, body, url FROM tips ORDER BY RANDOM() LIMIT 1");
      return row ? { id: row.id, title: row.title, body: row.body, url: row.url } : null;
    },
  };
  return repo;
}

export type Repository = ReturnType<typeof createRepository>;

/**
 * 日ごとの数を、グラフの系列にする（DB から切り離して、テストできるようにしている）
 * learned は累計。覚えた日が分からない単語（null）は、期間より前に覚えたものとして数える
 */
export function buildDailySeries(
  days: string[],
  studiedRows: { day: string; n: number }[],
  learnedRows: { day: string | null; n: number }[]
): { day: string; studied: number; learned: number }[] {
  const studiedByDay = new Map(studiedRows.map((row) => [row.day, row.n]));
  return days.map((day) => ({
    day,
    studied: studiedByDay.get(day) ?? 0,
    learned: learnedRows.filter((row) => row.day === null || row.day <= day).reduce((sum, row) => sum + row.n, 0),
  }));
}
