import fs from "fs";
import path from "path";
import type { Db, SqlParam } from "../database";

/**
 * テスト用の DB。PC 上で動く SQLite（sql.js）を、アプリの Db インターフェースに合わせる
 * アプリでは expo-sqlite が同じインターフェースを満たす
 */
export async function createTestDb(): Promise<Db & { close(): void }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require("sql.js");
  const wasmPath = path.join(path.dirname(require.resolve("sql.js")), "sql-wasm.wasm");
  const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasmPath) });
  const database = new SQL.Database();
  database.run("PRAGMA foreign_keys = ON");

  const query = <T>(sql: string, params: SqlParam[] = []): T[] => {
    const statement = database.prepare(sql);
    try {
      statement.bind(params);
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  };

  let depth = 0;
  return {
    async execAsync(sql) {
      database.exec(sql);
    },
    async runAsync(sql, params = []) {
      database.run(sql, params);
    },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      return query<T>(sql, params);
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      return query<T>(sql, params)[0] ?? null;
    },
    async withTransactionAsync(task) {
      // 入れ子の呼び出しは外側のトランザクションに含める
      if (depth > 0) return task();
      depth++;
      database.run("BEGIN");
      try {
        await task();
        database.run("COMMIT");
      } catch (error) {
        database.run("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
    close() {
      database.close();
    },
  };
}
