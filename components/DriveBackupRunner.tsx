import { useEffect } from "react";
import { AppState } from "react-native";
import { useDb } from "@/db/AppDatabase";
import { runAutoBackup } from "@/lib/driveBackup";

/** アプリを開いたとき・戻ったときに、Google ドライブへの自動バックアップを試す（オンで、前回から1日以上たっているときだけ保存される） */
export function DriveBackupRunner() {
  const db = useDb();
  useEffect(() => {
    runAutoBackup(db);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runAutoBackup(db);
    });
    return () => sub.remove();
  }, [db]);
  return null;
}
