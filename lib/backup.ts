import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import type { Db } from "@/db/database";
import { BACKUP_FILE_NAME, BackupError, exportBackup, parseBackup, restoreBackup } from "@/db/backup";

/**
 * バックアップの、端末のファイルへの書き出し・読み込み
 * - 毎日の自動バックアップは、Android 標準のバックアップ（Google のバックアップ）に任せる。アプリは、何もしない
 * - 手動の「書き出し」は、ファイルを作って、共有の画面から、好きな場所（Google ドライブなど）に保存してもらう
 * - 「復元」は、選んだファイルの内容で、今のデータを置き換える
 */

/** バックアップのファイルを作って、共有の画面を開く（保存先は、利用者が選ぶ） */
export async function shareBackupFile(db: Db): Promise<void> {
  const backup = await exportBackup(db);
  const file = new File(Paths.cache, BACKUP_FILE_NAME);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "バックアップを保存する" });
}

export type PickResult = { ok: true; text: string; name: string } | { ok: false; cancelled?: true; message?: string };

/** バックアップのファイルを選んで、中身の文字を読む（まだ、置き換えない。確認のあと、applyRestore で置き換える） */
export async function pickBackupFile(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return { ok: false, cancelled: true };
  const asset = result.assets[0];
  try {
    return { ok: true, text: await new File(asset.uri).text(), name: asset.name };
  } catch {
    return { ok: false, message: "ファイルを読み込めませんでした" };
  }
}

export type RestoreResult = { ok: true; cards: number } | { ok: false; message: string };

/** 選んだファイルの内容で、今のデータを置き換える。ファイルの内容に問題があれば、理由を返す（その場合、今のデータは変わらない） */
export async function applyRestore(db: Db, text: string): Promise<RestoreResult> {
  try {
    const cards = await restoreBackup(db, parseBackup(text));
    return { ok: true, cards };
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, message: error.message };
    console.warn("[backup] 復元に失敗:", error);
    return { ok: false, message: "復元できませんでした。今のデータは、変わっていません" };
  }
}
