import type { Db } from "@/db/database";
import { BACKUP_FILE_NAME, exportBackup } from "@/db/backup";
import GoogleDriveAuth from "../modules/google-drive-auth";

/**
 * Google ドライブへの自動バックアップ（アプリ専用の「appDataFolder」。利用者の Drive の画面には出ない）
 * - 同じ名前のファイルを探して、あれば上書き、なければ作る（ファイルは、いつも1つ）
 * - 開発者には、データも、アカウントの情報も届かない（端末と、利用者自身の Google ドライブの間だけ）
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
/** 「どのアカウントに保存しているか」を、設定に表示するためだけに使う（メールアドレスは、端末の中だけに保存する） */
export const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export const META_DRIVE_ENABLED = "drive_backup_enabled";
export const META_DRIVE_LAST = "drive_backup_last";
export const META_DRIVE_EMAIL = "drive_backup_email";
export const META_DRIVE_ASKED = "drive_restore_asked";

/** 自動バックアップの間隔（1日） */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveError";
  }
}

type Fetch = typeof fetch;

const check = async (response: Response, what: string): Promise<Response> => {
  if (response.ok) return response;
  if (response.status === 401 || response.status === 403) throw new DriveError(`${what}に失敗しました。Google ドライブへのアクセスを、もう一度許可してください`);
  throw new DriveError(`${what}に失敗しました（${response.status}）`);
};

/** appDataFolder の中のバックアップファイルの ID（なければ null） */
export async function findBackupFileId(token: string, fetcher: Fetch = fetch): Promise<string | null> {
  const query = new URLSearchParams({ spaces: "appDataFolder", q: `name = '${BACKUP_FILE_NAME}'`, fields: "files(id)", pageSize: "1" });
  const response = await check(await fetcher(`${API}/files?${query}`, { headers: { Authorization: `Bearer ${token}` } }), "バックアップの確認");
  const body = (await response.json()) as { files?: { id: string }[] };
  return body.files?.[0]?.id ?? null;
}

/** バックアップの内容を、同じファイルに上書きする（ファイルがなければ作る） */
export async function uploadBackup(token: string, text: string, fetcher: Fetch = fetch): Promise<void> {
  const existing = await findBackupFileId(token, fetcher);
  if (existing) {
    await check(
      await fetcher(`${UPLOAD}/files/${existing}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: text,
      }),
      "バックアップの保存"
    );
    return;
  }
  const boundary = "vocabook-boundary";
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  await check(
    await fetcher(`${UPLOAD}/files?uploadType=multipart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }),
    "バックアップの保存"
  );
}

/** 保存先の Google アカウントのメールアドレス（取れなければ null） */
export async function fetchEmail(token: string, fetcher: Fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return ((await response.json()) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

/** バックアップのファイルの中身を読む（なければ null） */
export async function downloadBackup(token: string, fetcher: Fetch = fetch): Promise<string | null> {
  const id = await findBackupFileId(token, fetcher);
  if (!id) return null;
  const response = await check(await fetcher(`${API}/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } }), "バックアップの読み込み");
  return response.text();
}

/** Google に、ドライブのアプリ専用の場所への権限を求める（許可済みなら、画面なしでトークンが返る） */
export async function getToken(): Promise<string> {
  if (!GoogleDriveAuth) throw new DriveError("この端末では、Google ドライブを使えません");
  try {
    const result = await GoogleDriveAuth.authorize([DRIVE_SCOPE, EMAIL_SCOPE]);
    if (!result.accessToken) throw new DriveError("Google ドライブへのアクセスを、許可してください");
    return result.accessToken;
  } catch (error) {
    if (error instanceof DriveError) throw error;
    const code = (error as { code?: string }).code;
    if (code === "ERR_CANCELED") throw new DriveError("許可がキャンセルされました");
    throw new DriveError("Google の認証に失敗しました。通信の状態を確認して、もう一度お試しください");
  }
}

const getMeta = async (db: Db, key: string): Promise<string | null> => (await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))?.value ?? null;
const setMeta = (db: Db, key: string, value: string) => db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);

export const isDriveBackupEnabled = async (db: Db): Promise<boolean> => (await getMeta(db, META_DRIVE_ENABLED)) === "1";
export const setDriveBackupEnabled = (db: Db, enabled: boolean) => setMeta(db, META_DRIVE_ENABLED, enabled ? "1" : "0");
export const lastDriveBackup = async (db: Db): Promise<number | null> => {
  const value = await getMeta(db, META_DRIVE_LAST);
  return value ? Number(value) : null;
};

export const driveEmail = (db: Db) => getMeta(db, META_DRIVE_EMAIL);

/** 単語がまだ1つもなく、この案内を出したことがないか（新しい端末の最初の起動を想定） */
export async function shouldOfferRestore(db: Db): Promise<boolean> {
  if (await getMeta(db, META_DRIVE_ASKED)) return false;
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM cards WHERE type = 'basic'");
  return (row?.n ?? 0) === 0;
}
export const markRestoreAsked = (db: Db) => setMeta(db, META_DRIVE_ASKED, "1");

/** 今、自動バックアップをするべきか（オンで、前回から1日以上たっている） */
export async function shouldAutoBackup(db: Db, at = Date.now()): Promise<boolean> {
  if (!(await isDriveBackupEnabled(db))) return false;
  const last = await lastDriveBackup(db);
  return last === null || at - last >= AUTO_BACKUP_INTERVAL_MS;
}

/** 今のデータを、Google ドライブに保存して、保存した時刻を覚える */
export async function backupToDrive(db: Db, fetcher: Fetch = fetch, token?: string): Promise<number> {
  const accessToken = token ?? (await getToken());
  await uploadBackup(accessToken, JSON.stringify(await exportBackup(db)), fetcher);
  const at = Date.now();
  await setMeta(db, META_DRIVE_LAST, String(at));
  const email = await fetchEmail(accessToken, fetcher);
  if (email) await setMeta(db, META_DRIVE_EMAIL, email);
  return at;
}

/** Google ドライブのバックアップの中身を読む（まだ、置き換えない）。なければ null */
export async function fetchDriveBackup(fetcher: Fetch = fetch): Promise<string | null> {
  return downloadBackup(await getToken(), fetcher);
}

/** 自動バックアップ。失敗しても、アプリの使用の邪魔をしないように、エラーは返すだけにする */
export async function runAutoBackup(db: Db): Promise<{ ok: boolean; message?: string }> {
  try {
    if (!(await shouldAutoBackup(db))) return { ok: true };
    await backupToDrive(db);
    return { ok: true };
  } catch (error) {
    console.warn("[drive] 自動バックアップに失敗:", error);
    return { ok: false, message: error instanceof DriveError ? error.message : "バックアップできませんでした" };
  }
}
