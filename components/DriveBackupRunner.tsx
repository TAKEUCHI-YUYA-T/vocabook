import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import { useDb } from "@/db/AppDatabase";
import { applyRestore } from "@/lib/backup";
import { fetchDriveBackup, markRestoreAsked, runAutoBackup, shouldOfferRestore } from "@/lib/driveBackup";

/** アプリを開いたとき・戻ったときに、Google ドライブへの自動バックアップを試す（オンで、前回から1日以上たっているときだけ保存される） */
export function DriveBackupRunner() {
  const db = useDb();
  useEffect(() => {
    // 単語が空の最初の起動（新しい端末）では、1度だけ、Google ドライブからの復元を案内する
    shouldOfferRestore(db).then(async (offer) => {
      if (!offer) return;
      await markRestoreAsked(db);
      Alert.alert("以前のデータを復元しますか？", "Google ドライブに保存したバックアップから、単語と学習の記録を復元できます。", [
        { text: "しない", style: "cancel" },
        {
          text: "復元する",
          onPress: async () => {
            try {
              const text = await fetchDriveBackup();
              if (!text) return Alert.alert("バックアップがありません", "この Google アカウントの Google ドライブに、バックアップが見つかりませんでした。");
              const result = await applyRestore(db, text);
              Alert.alert(result.ok ? "復元しました" : "復元できませんでした", result.ok ? `${result.cards}語を復元しました。` : result.message);
            } catch (error) {
              Alert.alert("復元できませんでした", error instanceof Error ? error.message : "通信の状態を確認して、もう一度お試しください。");
            }
          },
        },
      ]);
    });
    runAutoBackup(db);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runAutoBackup(db);
    });
    return () => sub.remove();
  }, [db]);
  return null;
}
