export const fetchSpreadsheetData = async (sheetTypes) => {
  try {
    const responses = await Promise.all(
        sheetTypes.map(async (sheetType) => {
          const response = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/
          // 1_qAyYwxy-iEhJjsRWf8jaAmloc-ixYG2FRcH14Gg7zg/values/
          // ${sheetType}?key=AIzaSyAtFydjUf60nfPhC2FJuyV9QQfHANcJlnY`,
          );
          const json = await response.json();

          if (!json.values) {
            console.warn(`データが無効です (${sheetType})`, json);
            return {sheetType, data: []};
          }

          return {sheetType, data: json.values};
        }),
    );

    return responses;
  } catch (error) {
    console.error(`Google Sheets API エラー:`, error);
    return [];
  }
};


// const functions = require("firebase-functions");
// const admin = require("firebase-admin");
// const fetch = require("node-fetch");

// admin.initializeApp();

// exports.getSpreadsheetData = functions.https.onRequest(async (req, res) => {
//   try {
//     const sheetId =
//      "1_qAyYwxy-iEhJjsRWf8jaAmloc-ixYG2FRcH14Gg7zg";
//     const sheetName =
//     req.query.sheet;

//     const apiKey = functions.config().sheets.apikey;
//     const url =
//      `https://sheets.googleapis.com/v4/spreadsheets/
//      // ${sheetId}/values/${sheetName}?key=${apiKey}`;

//     const response = await fetch(url);
//     const data = await response.json();

//     if (!data.values) {
//       return res.status(400).json({error: "データがありません"});
//     }

//     res.json({sheetName, data: data.values});
//   } catch (error) {
//     console.error("エラー:", error);
//     res.status(500).json({error: "データ取得中にエラーが発生しました"});
//   }
// });
