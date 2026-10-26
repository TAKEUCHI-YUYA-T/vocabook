import { Directory, File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import type { Db } from "@/db/database";
import {
  BACKUP_FILE_NAME,
  META_BACKUP_FOLDER,
  META_BACKUP_FOLDER_NAME,
  META_BACKUP_LAST_AT,
  META_BACKUP_LAST_ERROR,
  BackupError,
  exportBackup,
  getMeta,
  parseBackup,
  restoreBackup,
  setMeta,
  shouldAutoBackup,
} from "@/db/backup";
import { localDay } from "@/db/day";

/**
 * バックアップの、端末のファイルへの書き込み・読み込み
 * 保存先のフォルダは、一度選べば、アプリが覚えている（Android のフォルダの許可を、保持する）
 * 毎回、同じ名前のファイル（vocabook-backup.json）を、上書きする
 */

export type BackupState = {
  folderName: string | null;
  lastAt: string | null;
  lastError: string | null;
};

export async function readBackupState(db: Db): Promise<BackupState> {
  return {
    folderName: await getMeta(db, META_BACKUP_FOLDER_NAME),
    lastAt: await getMeta(db, META_BACKUP_LAST_AT),
    lastError: await getMeta(db, META_BACKUP_LAST_ERROR),
  };
}

/** フォルダの名前（Android の URI の最後の部分）を、人が読める形にする。例: "primary%3ADocuments%2Fvocabook" → "Documents/vocabook" */
export function folderDisplayName(name: string): string {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // 読めない形は、そのまま出す
  }
  const afterColon = decoded.includes(":") ? decoded.slice(decoded.lastIndexOf(":") + 1) : decoded;
  return afterColon || decoded;
}

/** 保存先のフォルダを選ぶ（選ばなかったら、null）。選んだフォルダは、覚える */
export async function chooseBackupFolder(db: Db): Promise<boolean> {
  try {
    const directory = await Directory.pickDirectoryAsync();
    await setMeta(db, META_BACKUP_FOLDER, directory.uri);
    await setMeta(db, META_BACKUP_FOLDER_NAME, folderDisplayName(directory.name));
    await setMeta(db, META_BACKUP_LAST_ERROR, null);
    return true;
  } catch {
    // 選ぶのをやめたときも、ここに来る
    return false;
  }
}

export type BackupResult = { ok: true; at: string; cards: number } | { ok: false; message: string };

/**
 * バックアップを、保存先のフォルダに作る（同じ名前のファイルがあれば、上書き）
 * 失敗したら、理由を、設定の画面に出せるよう、記録する（アプリは落とさない）
 */
export async function runBackup(db: Db, now: Date = new Date()): Promise<BackupResult> {
  try {
    const uri = await getMeta(db, META_BACKUP_FOLDER);
    if (!uri) return { ok: false, message: "保存先のフォルダが選ばれていません" };
    const backup = await exportBackup(db, now);
    const json = JSON.stringify(backup);

    const directory = new Directory(uri);
    const existing = directory.list().find((entry): entry is File => entry instanceof File && entry.name === BACKUP_FILE_NAME);
    const file = existing ?? directory.createFile(BACKUP_FILE_NAME, "application/json");
    file.write(json);

    const at = now.toISOString();
    await setMeta(db, META_BACKUP_LAST_AT, at);
    await setMeta(db, META_BACKUP_LAST_ERROR, null);
    return { ok: true, at, cards: backup.cards.length };
  } catch (error) {
    const message = "保存先に書き込めませんでした。フォルダを選び直してください";
    console.warn("[backup] 失敗:", error);
    await setMeta(db, META_BACKUP_LAST_ERROR, message).catch(() => undefined);
    return { ok: false, message };
  }
}

/** 日付が変わっていて、保存先があれば、自動でバックアップする（アプリを開いたとき・戻ってきたとき） */
export async function runAutoBackupIfDue(db: Db, now: Date = new Date()): Promise<void> {
  const folder = await getMeta(db, META_BACKUP_FOLDER);
  const lastAt = await getMeta(db, META_BACKUP_LAST_AT);
  const due = shouldAutoBackup({ folder, lastAt, today: localDay(now), dayOf: (iso) => localDay(new Date(iso)) });
  if (due) await runBackup(db, now);
}

/** フォルダに書けないとき用の予備: ファイルを作って、共有の画面から、好きな場所に保存してもらう */
export async function shareBackupFile(db: Db): Promise<void> {
  const backup = await exportBackup(db);
  const file = new File(Paths.cache, BACKUP_FILE_NAME);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "バックアップを保存する" });
}

export type RestoreResult = { ok: true; cards: number } | { ok: false; message: string } | { ok: false; cancelled: true };

/** バックアップのファイルを選んで、内容を確かめる（まだ、置き換えない）。確認のあと、applyRestore で置き換える */
export async function pickBackupFile(): Promise<{ ok: true; text: string; name: string } | { ok: false; cancelled?: true; message?: string }> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return { ok: false, cancelled: true };
  const asset = result.assets[0];
  try {
    return { ok: true, text: await new File(asset.uri).text(), name: asset.name };
  } catch {
    return { ok: false, message: "ファイルを読み込めませんでした" };
  }
}

/** 選んだファイルの内容で、今のデータを置き換える。ファイルの内容に問題があれば、理由を返す */
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
