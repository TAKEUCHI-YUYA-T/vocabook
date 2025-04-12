require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
const PORT = 3001; // Expoとは別のポート

app.use(cors()); // CORSを有効化（フロントエンドからのリクエストを許可）
app.use(express.json()); // JSONリクエストをパース

// Google API 認証設定
const auth = new google.auth.GoogleAuth({
  keyFile: "./service-account.json", // サービスアカウントのJSONキー
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Google API を使用するエンドポイント
app.get("/api/google-data", async (req, res) => {
  try {
    const authClient = await auth.getClient();
    const projectId = await auth.getProjectId();

    res.json({ message: "Google API 認証成功", projectId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`✅ サーバーが http://localhost:${PORT} で起動しました`);
});
