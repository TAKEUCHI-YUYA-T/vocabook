import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { applyDataFixes } from "./dataFixes";
import { migrate } from "./migrations";
import { ensureDefaultDeck, syncPresets, type PresetData } from "./presets";
import { createRepository, type Repository } from "./repository";
import type { Db, SqlParam } from "./database";

import presetIngOrTo from "../assets/presets/ing-or-to.json";
import presetTips from "../assets/presets/tips.json";
import presetVersion from "../assets/presets/version.json";

const DATABASE_NAME = "vocabook.db";

const presets = {
  version: presetVersion.version,
  ingOrTo: presetIngOrTo,
  tips: presetTips,
} as PresetData;

/** expo-sqlite のデータベースを、アプリ共通の Db インターフェースに合わせる */
const toDb = (database: SQLiteDatabase): Db => ({
  execAsync: (sql) => database.execAsync(sql),
  async runAsync(sql, params: SqlParam[] = []) {
    await database.runAsync(sql, params);
  },
  getAllAsync: (sql, params = []) => database.getAllAsync(sql, params),
  getFirstAsync: (sql, params = []) => database.getFirstAsync(sql, params),
  withTransactionAsync: (task) => database.withTransactionAsync(task),
});

/** 起動時に、データ構造を最新にして、同梱のデータを反映し、初回なら空の単語帳を用意する */
async function initialize(database: SQLiteDatabase) {
  const db = toDb(database);
  await db.execAsync("PRAGMA foreign_keys = ON");
  await migrate(db);
  await syncPresets(db, presets);
  await ensureDefaultDeck(db);
  // 一度だけの単語データの修正（開発者の端末だけで動く）。失敗しても、起動は止めない
  try {
    const fixed = await applyDataFixes(db);
    if (fixed) console.warn("[data-fix]", JSON.stringify(fixed));
  } catch (error) {
    console.warn("[data-fix] 失敗（元のまま）:", error);
  }
}

const hideSplash = () => {
  SplashScreen.hideAsync().catch(() => {
    // すでに閉じている場合などは無視してよい
  });
};

const RepositoryContext = createContext<Repository | null>(null);

/** DB の準備ができてから描画される。ここで初めてスプラッシュ画面を閉じる */
function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const database = useSQLiteContext();
  const repository = useMemo(() => createRepository(toDb(database)), [database]);
  useEffect(hideSplash, []);
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

/** 画面から単語帳・単語を読み書きするための入口 */
export function useRepository(): Repository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("useRepository は AppDatabase の中で使ってください");
  return repository;
}

/**
 * アプリ全体を包み、DB の準備ができるまでスプラッシュ画面のまま待つ
 * 準備に失敗したら、理由と再試行のボタンを出す（アプリは落とさない）
 */
export function AppDatabase({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  // SQLiteProvider は描画の途中で onError を呼ぶため、状態の更新は描画の後に回す
  const handleError = useCallback((e: Error) => {
    setTimeout(() => setError(e), 0);
  }, []);

  useEffect(() => {
    if (error) hideSplash();
  }, [error]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>データを開けませんでした</Text>
        <Text style={styles.message}>{error.message}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          <Text style={styles.buttonText}>もう一度試す</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SQLiteProvider key={attempt} databaseName={DATABASE_NAME} onInit={initialize} onError={handleError}>
      <RepositoryProvider>{children}</RepositoryProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#fffeef", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12, color: "black" },
  message: { fontSize: 16, color: "#446158", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#9fd700", padding: 15, borderRadius: 10, width: "80%", alignItems: "center" },
  buttonText: { color: "#446158", fontSize: 18, fontWeight: "bold" },
});
