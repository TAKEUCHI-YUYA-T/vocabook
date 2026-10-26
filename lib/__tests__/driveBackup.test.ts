import { migrate } from "@/db/migrations";
import { createTestDb } from "@/db/testing/testDb";
import { AUTO_BACKUP_INTERVAL_MS, backupToDrive, downloadBackup, setDriveBackupEnabled, shouldAutoBackup, uploadBackup } from "../driveBackup";

jest.mock("../../modules/google-drive-auth", () => ({ __esModule: true, default: null }));

type Call = { url: string; method: string; body?: string };

/** Drive の代わりをする、ファイル1つだけの偽のサーバー */
const fakeDrive = () => {
  const calls: Call[] = [];
  let content: string | null = null;
  const fetcher = (async (url: string, init: { method?: string; body?: string } = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body });
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data, text: async () => String(data) });
    if (url.includes("/files?spaces")) return json({ files: content === null ? [] : [{ id: "f1" }] });
    if (url.includes("uploadType=multipart")) {
      content = init.body!.split("\r\n\r\n")[2].split("\r\n--")[0];
      return json({ id: "f1" });
    }
    if (url.includes("uploadType=media")) {
      content = init.body!;
      return json({ id: "f1" });
    }
    if (url.includes("alt=media")) return { ok: true, status: 200, text: async () => content };
    return { ok: false, status: 500 };
  }) as unknown as typeof fetch;
  return { calls, fetcher, get content() { return content; } };
};

describe("Google ドライブへのバックアップ", () => {
  it("1回目は作成、2回目は同じファイルに上書きして、中身を読み戻せる", async () => {
    const drive = fakeDrive();
    await uploadBackup("t", '{"a":1}', drive.fetcher);
    expect(drive.calls.some((c) => c.method === "POST")).toBe(true);
    await uploadBackup("t", '{"a":2}', drive.fetcher);
    expect(drive.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(drive.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
    expect(drive.content).toBe('{"a":2}');
    expect(await downloadBackup("t", drive.fetcher)).toBe('{"a":2}');
  });

  it("ファイルがなければ、読み込みは null", async () => {
    expect(await downloadBackup("t", fakeDrive().fetcher)).toBeNull();
  });

  it("権限のエラーは、許可し直すよう案内する", async () => {
    const fetcher = (async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    await expect(uploadBackup("t", "{}", fetcher)).rejects.toThrow("もう一度許可");
  });

  it("オンで、前回から1日以上たったときだけ、自動バックアップする。保存した時刻を覚える", async () => {
    const db = await createTestDb();
    await migrate(db);
    expect(await shouldAutoBackup(db)).toBe(false);
    await setDriveBackupEnabled(db, true);
    expect(await shouldAutoBackup(db)).toBe(true);
    const drive = fakeDrive();
    const at = await backupToDrive(db, drive.fetcher, "t");
    expect(await shouldAutoBackup(db, at + 1000)).toBe(false);
    expect(await shouldAutoBackup(db, at + AUTO_BACKUP_INTERVAL_MS)).toBe(true);
    expect(JSON.parse(drive.content!).format).toBe("vocabook-backup");
  });
});
