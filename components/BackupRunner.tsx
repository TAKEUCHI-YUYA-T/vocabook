import { useEffect } from "react";
import { AppState } from "react-native";
import { useDb } from "@/db/AppDatabase";
import { runAutoBackupIfDue } from "@/lib/backup";

/**
 * 自動バックアップを、動かす（画面には何も出さない）
 * アプリを開いたときと、別のアプリから戻ってきたときに、「保存先があって、今日まだバックアップしていない」なら、1回だけ作る
 * 失敗しても、アプリは使える（失敗の理由は、設定の画面に出る）
 */
export function BackupRunner() {
  const db = useDb();
  useEffect(() => {
    const run = () => {
      runAutoBackupIfDue(db).catch((error) => console.warn("[backup] 自動バックアップに失敗:", error));
    };
    run();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => subscription.remove();
  }, [db]);
  return null;
}
