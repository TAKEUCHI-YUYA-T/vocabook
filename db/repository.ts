import { newId, now, type Db, type SqlParam } from "./database";
import { DEFAULT_DECK_NAME } from "./presets";
import type { Card, CardInput, CardType, Deck, DeckKind, DeckSummary, IngOrToAnswer, PartOfSpeech, StudyFilter, Tip } from "./types";
import { PARTS_OF_SPEECH } from "./types";

/** 入力できる長さの上限。極端に長い値でアプリが重くならないようにする */
export const LIMITS = { term: 200, meaning: 1000, example: 2000, note: 2000, deckName: 100 } as const;

export class ValidationError extends Error {}

type DeckRow = { id: string; name: string; kind: DeckKind; created_at: number; updated_at: number; card_count?: number };
type CardRow = {
  id: string; deck_id: string; type: CardType; term: string; meaning: string; part_of_speech: string | null;
  example: string; example_translation: string; note: string; answer: string; position: number; created_at: number; updated_at: number;
};

const toDeck = (row: DeckRow): Deck => ({ id: row.id, name: row.name, kind: row.kind, createdAt: row.created_at, updatedAt: row.updated_at });

const toCard = (row: CardRow): Card => ({
  id: row.id,
  deckId: row.deck_id,
  type: row.type,
  term: row.term,
  meaning: row.meaning,
  partOfSpeech: PARTS_OF_SPEECH.some((p) => p.key === row.part_of_speech) ? (row.part_of_speech as PartOfSpeech) : null,
  example: row.example,
  exampleTranslation: row.example_translation,
  note: row.note,
  answer: row.answer,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const CARD_COLUMNS =
  "id, deck_id, type, term, meaning, part_of_speech, example, example_translation, note, answer, position, created_at, updated_at";

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
): Required<Omit<CardInput, "partOfSpeech" | "answer">> & { partOfSpeech: PartOfSpeech | null; answer: IngOrToAnswer | null } {
  const term = input.term.trim();
  const meaning = input.meaning.trim();
  const example = (input.example ?? "").trim();
  const exampleTranslation = (input.exampleTranslation ?? "").trim();
  const note = (input.note ?? "").trim();

  if (!term) throw new ValidationError("単語を入力してください");
  if (!meaning && !options.allowEmptyMeaning) throw new ValidationError("意味を入力してください");
  if (term.length > LIMITS.term) throw new ValidationError(`単語は${LIMITS.term}文字以内で入力してください`);
  if (meaning.length > LIMITS.meaning) throw new ValidationError(`意味は${LIMITS.meaning}文字以内で入力してください`);
  if (example.length > LIMITS.example || exampleTranslation.length > LIMITS.example) {
    throw new ValidationError(`例文は${LIMITS.example}文字以内で入力してください`);
  }
  if (note.length > LIMITS.note) throw new ValidationError(`メモは${LIMITS.note}文字以内で入力してください`);

  const pos = input.partOfSpeech ?? null;
  if (pos !== null && !PARTS_OF_SPEECH.some((p) => p.key === pos)) throw new ValidationError("品詞が正しくありません");

  const answer = input.answer ?? null;
  if (answer !== null && answer !== "ing" && answer !== "to") throw new ValidationError("ing or to の答えが正しくありません");

  return { term, meaning, example, exampleTranslation, note, partOfSpeech: pos, answer };
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
        where += " AND (term LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\' OR example LIKE ? ESCAPE '\\')";
        const pattern = `%${escapeLike(trimmed)}%`;
        params.push(pattern, pattern, pattern);
      }
      const rows = await db.getAllAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE ${where} ORDER BY position, created_at`, params);
      return rows.map(toCard);
    },

    async getCard(id: string): Promise<Card | null> {
      const row = await db.getFirstAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE id = ? AND deleted_at IS NULL`, [id]);
      return row ? toCard(row) : null;
    },

    /** 同じ単語（大文字小文字を区別しない）がすでにあるか。追加時の重複警告に使う */
    async findDuplicates(deckId: string, term: string, excludeCardId?: string): Promise<Card[]> {
      const rows = await db.getAllAsync<CardRow>(
        `SELECT ${CARD_COLUMNS} FROM cards WHERE deck_id = ? AND deleted_at IS NULL AND LOWER(term) = LOWER(?) AND id <> ?`,
        [deckId, term.trim(), excludeCardId ?? ""]
      );
      return rows.map(toCard);
    },

    async addCard(deckId: string, input: CardInput): Promise<Card> {
      await requireEditableDeck(deckId);
      const value = validateCardInput(input);
      const id = newId();
      const timestamp = now();
      const last = await db.getFirstAsync<{ max_position: number | null }>("SELECT MAX(position) AS max_position FROM cards WHERE deck_id = ?", [deckId]);
      const position = (last?.max_position ?? -1) + 1;
      await db.runAsync(
        `INSERT INTO cards (${CARD_COLUMNS}) VALUES (?, ?, 'basic', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, deckId, value.term, value.meaning, value.partOfSpeech, value.example, value.exampleTranslation, value.note, value.answer ?? "", position, timestamp, timestamp]
      );
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
          for (const value of chunk) {
            params.push(newId(), deckId, value.term, value.meaning, value.partOfSpeech, value.example, value.exampleTranslation, value.note, value.answer ?? "", position++, timestamp, timestamp);
          }
          const placeholders = chunk.map(() => "(?, ?, 'basic', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
          await db.runAsync(`INSERT INTO cards (${CARD_COLUMNS}) VALUES ${placeholders}`, params);
        }
      });
      return values.length;
    },

    async updateCard(id: string, input: CardInput): Promise<Card> {
      const existing = await repo.getCard(id);
      if (!existing) throw new ValidationError("単語が見つかりません");
      await requireEditableDeck(existing.deckId);
      const value = validateCardInput(input, { allowEmptyMeaning: existing.meaning === "" });
      await db.runAsync(
        "UPDATE cards SET term = ?, meaning = ?, part_of_speech = ?, example = ?, example_translation = ?, note = ?, answer = ?, updated_at = ? WHERE id = ?",
        [value.term, value.meaning, value.partOfSpeech, value.example, value.exampleTranslation, value.note, value.answer ?? "", now(), id]
      );
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
      const rows = await db.getAllAsync<CardRow>(`SELECT ${CARD_COLUMNS} FROM cards WHERE ${where}`, params);
      return rows.map(toCard);
    },

    /** ing or to の問題（同梱の問題と、ing or to の答えを付けた自分の単語） */
    async listIngOrToCards(): Promise<Card[]> {
      const rows = await db.getAllAsync<CardRow>(
        `SELECT ${CARD_COLUMNS} FROM cards
         WHERE deleted_at IS NULL AND (type = 'ing_or_to' OR (type = 'basic' AND answer IN ('ing', 'to')))
         ORDER BY position`
      );
      return rows.map(toCard);
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
