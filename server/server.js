require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // 改行処理

// Google Sheets API 認証設定
const auth = new google.auth.JWT(
  SERVICE_ACCOUNT_EMAIL,
  null,
  SERVICE_ACCOUNT_PRIVATE_KEY,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

// APIエンドポイント: referenceシートのA, B, C列のデータ取得
app.get("/api/google-sheets/reference", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "reference!A1:C", // A, B, C 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: nounシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/noun", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "noun!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: verbシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/verb", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "verb!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: adverbシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/adverb", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "adverb!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: adjectiveシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/adjective", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "adjective!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: prepositionシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/preposition", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "preposition!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: conjunctionシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/conjunction", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "conjunction!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: auxiliary verbシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/auxiliaryVerb", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "auxiliaryVerb!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: idiomシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/idiom", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "idiom!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// APIエンドポイント: ing or toシートのA, B, C, D, E列のデータ取得
app.get("/api/google-sheets/ingOrTo", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "ingOrTo!A1:E", // A, B, C, D, E 列のデータ取得
    });

    const values = response.data.values || [];
    res.json({ data: values });
  } catch (error) {
    console.error("Google Sheets API エラー:", error);
    res.status(500).json({ error: "データ取得エラー" });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
});


// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const { google } = require("googleapis");

// const app = express();
// app.use(cors());
// app.use(express.json());

// const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
// const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // 改行処理

// // Google Sheets API 認証設定
// const auth = new google.auth.JWT(
//   SERVICE_ACCOUNT_EMAIL,
//   null,
//   SERVICE_ACCOUNT_PRIVATE_KEY,
//   ["https://www.googleapis.com/auth/spreadsheets"]
// );

// // APIエンドポイント: A, B, C列のデータ取得
// app.get("/api/google-sheets", async (req, res) => {
//   try {
//     const sheets = google.sheets({ version: "v4", auth });
//     const response = await sheets.spreadsheets.values.get({
//       spreadsheetId: SHEET_ID,
//       range: "reference!A1:C", // A, B, C 列のデータ取得
//     });

//     const values = response.data.values || [];
//     res.json({ data: values });
//   } catch (error) {
//     console.error("Google Sheets API エラー:", error);
//     res.status(500).json({ error: "データ取得エラー" });
//   }
// });

// // サーバー起動
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
// });


// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const { google } = require("googleapis");

// const app = express();
// app.use(cors());
// app.use(express.json());

// const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
// const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // 改行処理

// // Google Sheets API 認証設定
// const auth = new google.auth.JWT(
//   SERVICE_ACCOUNT_EMAIL,
//   null,
//   SERVICE_ACCOUNT_PRIVATE_KEY,
//   ["https://www.googleapis.com/auth/spreadsheets"]
// );

// const sheets = google.sheets({ version: "v4", auth });

// // ✅ `reference` シートのデータ取得用エンドポイント
// app.get("/api/reference", async (req, res) => {
//   try {
//     const response = await sheets.spreadsheets.values.get({
//       spreadsheetId: SHEET_ID,
//       range: "reference!A1:C", // A～C列
//     });
//     res.json({ data: response.data.values || [] });
//   } catch (error) {
//     console.error("Google Sheets API エラー (reference):", error);
//     res.status(500).json({ error: "データ取得エラー" });
//   }
// });

// // ✅ `noun` & `verb` シートのデータ取得用エンドポイント
// app.get("/api/words", async (req, res) => {
//   try {
//     const nounResponse = await sheets.spreadsheets.values.get({
//       spreadsheetId: SHEET_ID,
//       range: "noun!A1:E", // A～E列
//     });
//     const verbResponse = await sheets.spreadsheets.values.get({
//       spreadsheetId: SHEET_ID,
//       range: "verb!A1:E", // A～E列
//     });

//     res.json({
//       noun: nounResponse.data.values || [],
//       verb: verbResponse.data.values || [],
//     });
//   } catch (error) {
//     console.error("Google Sheets API エラー (words):", error);
//     res.status(500).json({ error: "データ取得エラー" });
//   }
// });

// // サーバー起動
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
// });
