import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import GoogleDriveAuth from "@/modules/google-drive-auth";

/**
 * Phase 1a 技術検証画面（開発ビルド専用）
 * - drive.file 権限を取得し、シートの作成・書き込み・読み戻しができるか
 * - 再インストール後も、アプリが作ったシートを Drive から探せるか
 * を実機で確かめる
 */

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SPREADSHEET_TITLE = "vocabook 検証用";
const TAB = "検証";

/**
 * アクセストークン付きで Google API を呼び、失敗時は HTTP ステータスと理由を含むエラーを投げる
 */
const googleFetch = async (token: string, url: string, init: RequestInit = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${json?.error?.message ?? "不明なエラー"}`);
  }
  return json;
};

export default function SheetsSpikeScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`${time} ${message}`, ...prev]);
  };

  /**
   * 各操作を実行し、成否をログに残す共通処理
   */
  const run = async (label: string, action: () => Promise<void>) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      log(`✗ ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    setIsBusy(false);
  };

  const requireToken = () => {
    if (!token) throw new Error("先に「Google と連携」を押してください");
    return token;
  };

  const requireSpreadsheet = () => {
    if (!spreadsheetId) throw new Error("先にシートを作成するか、Drive から探してください");
    return spreadsheetId;
  };

  /** drive.file 権限を要求し、アクセストークンを受け取る */
  const handleAuthorize = () =>
    run("連携", async () => {
      if (!GoogleDriveAuth) throw new Error("この端末では未対応です（Android のみ実装）");
      const result = await GoogleDriveAuth.authorize([DRIVE_FILE_SCOPE]);
      if (!result.accessToken) throw new Error("アクセストークンが返りませんでした");
      setToken(result.accessToken);
      log(`✓ 連携: 許可されたスコープ ${result.grantedScopes.join(", ")}`);

      // 受け取ったトークンを Google に問い合わせて、有効かどうかを確かめる
      const info = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(result.accessToken)}`
      );
      const infoJson = await info.json().catch(() => ({}));
      log(
        info.ok
          ? `✓ トークン有効: 残り ${infoJson.expires_in} 秒`
          : `✗ トークン無効: HTTP ${info.status} ${infoJson.error_description ?? ""}`
      );
    });

  /** シートを作成し、見出し行を書き込む */
  const handleCreate = () =>
    run("シート作成", async () => {
      const accessToken = requireToken();
      const created = await googleFetch(accessToken, "https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        body: JSON.stringify({
          properties: { title: SPREADSHEET_TITLE },
          sheets: [{ properties: { title: TAB } }],
        }),
      });
      await googleFetch(
        accessToken,
        `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/${encodeURIComponent(`${TAB}!A1:C1`)}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [["単語", "意味", "追加日時"]] }) }
      );
      setSpreadsheetId(created.spreadsheetId);
      log(`✓ シート作成: ${created.spreadsheetUrl}`);
    });

  /** 1行追記する */
  const handleAppend = () =>
    run("書き込み", async () => {
      const accessToken = requireToken();
      const id = requireSpreadsheet();
      await googleFetch(
        accessToken,
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${TAB}!A:C`)}:append?valueInputOption=RAW`,
        {
          method: "POST",
          body: JSON.stringify({ values: [["apple", "りんご", new Date().toISOString()]] }),
        }
      );
      log("✓ 書き込み: 1行追加しました");
    });

  /** シートの中身を読み戻す */
  const handleRead = () =>
    run("読み戻し", async () => {
      const accessToken = requireToken();
      const id = requireSpreadsheet();
      const json = await googleFetch(
        accessToken,
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${TAB}!A1:C`)}`
      );
      const rows: string[][] = json.values ?? [];
      log(`✓ 読み戻し: ${rows.length}行\n${rows.map((row) => row.join(" | ")).join("\n")}`);
    });

  /** アプリが作ったシートを Drive から探す（再インストール後の再接続の検証） */
  const handleFind = () =>
    run("Drive 検索", async () => {
      const accessToken = requireToken();
      const query = `name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const json = await googleFetch(
        accessToken,
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id,name,createdTime)")}`
      );
      const files: { id: string; createdTime: string }[] = json.files ?? [];
      if (files.length === 0) {
        log("✓ Drive 検索: 見つかりませんでした");
        return;
      }
      setSpreadsheetId(files[0].id);
      log(`✓ Drive 検索: ${files.length}件。最初の1件（${files[0].createdTime}）に接続しました`);
    });

  /** 付与した権限を取り消す（同意画面からやり直す検証用） */
  const handleRevoke = () =>
    run("権限の取り消し", async () => {
      const accessToken = requireToken();
      const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setToken(null);
      setSpreadsheetId(null);
      log("✓ 権限の取り消し: 完了しました");
    });

  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google スプレッドシート連携の検証</Text>
      <Text style={styles.status}>
        連携: {token ? "済み" : "未"} ／ シート: {spreadsheetId ? "接続中" : "未"}
      </Text>

      <View style={styles.buttonContainer}>
        {[
          { label: "1. Google と連携", onPress: handleAuthorize },
          { label: "2. シートを作成", onPress: handleCreate },
          { label: "3. 1行書き込む", onPress: handleAppend },
          { label: "4. 読み戻す", onPress: handleRead },
          { label: "5. Drive から探す", onPress: handleFind },
          { label: "権限を取り消す", onPress: handleRevoke },
        ].map(({ label, onPress }) => (
          <TouchableOpacity
            key={label}
            style={[styles.button, isBusy && styles.disabledButton]}
            disabled={isBusy}
            onPress={onPress}
          >
            <Text style={styles.buttonText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => router.replace("/")}>
          <Text style={styles.topButtonText}>トップに戻る</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((line, index) => (
          <Text key={index} style={styles.logText}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffeef",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    color: "#446158",
    textAlign: "center",
    marginBottom: 10,
  },
  buttonContainer: {
    alignItems: "center",
  },
  button: {
    backgroundColor: "#9fd700",
    padding: 12,
    borderRadius: 10,
    marginVertical: 4,
    width: "90%",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "gray",
  },
  buttonText: {
    color: "#446158",
    fontSize: 16,
    fontWeight: "bold",
  },
  backButton: {
    backgroundColor: "#ff5757",
  },
  topButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  logContainer: {
    flex: 1,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 10,
    padding: 8,
  },
  logText: {
    fontSize: 13,
    color: "black",
    marginBottom: 6,
  },
});
