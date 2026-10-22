import type { Db } from "./database";

/**
 * データ構造の変更履歴
 * 公開後は、既存ユーザーのデータを壊さないよう、過去の項目は書き換えず、
 * 新しい番号の変更を末尾に足していく。PRAGMA user_version で適用済みの番号を管理する
 */
const MIGRATIONS: string[] = [
  // 1: 初期構造
  `
  CREATE TABLE decks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('preset', 'user')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    type TEXT NOT NULL DEFAULT 'basic' CHECK (type IN ('basic', 'ing_or_to')),
    term TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    part_of_speech TEXT,
    example TEXT NOT NULL DEFAULT '',
    example_translation TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_cards_deck ON cards (deck_id, deleted_at, position);

  CREATE TABLE tips (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

/**
 * 未適用の変更を順番に適用する
 * 変更ごとにトランザクションで囲み、途中で失敗しても半端な状態を残さない
 */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  if (current > LATEST_SCHEMA_VERSION) {
    // このアプリより新しい版で作られたデータ。古いアプリで開いて壊さないよう、止める
    throw new Error(`データの版（${current}）が、このアプリの対応（${LATEST_SCHEMA_VERSION}）より新しいです。アプリを更新してください`);
  }

  for (let version = current + 1; version <= LATEST_SCHEMA_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version - 1]);
      // PRAGMA はバインド変数を使えないため、整数であることを確かめて埋め込む
      await db.execAsync(`PRAGMA user_version = ${Number(version)}`);
    });
  }
}
