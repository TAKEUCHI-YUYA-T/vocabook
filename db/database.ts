/**
 * アプリのデータ処理が頼る、DB の最小限のインターフェース
 * アプリでは expo-sqlite を、テストでは PC 上の SQLite（sql.js）を差し込む
 */
export type SqlParam = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** 現在の日時（ミリ秒）。テストで差し替えられるように関数にしている */
export const now = (): number => Date.now();

/**
 * 重複しない ID を作る（ユーザーが作るデータ用）
 * 端末内の保存だけなら十分で、将来の同期でも衝突しにくい長さにしている
 */
export const newId = (): string => {
  const random = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `${Date.now().toString(16)}-${random()}-${random()}`;
};
