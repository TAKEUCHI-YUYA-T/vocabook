import Constants from "expo-constants";
const apiKey = Constants.expoConfig?.extra?.GOOGLE_API_KEY;
const sheetID = Constants.expoConfig?.extra?.SPREAD_SHEET_ID;

export const fetchSpreadsheetData = async (sheetTypes: string[]) => {
  // API キーをアプリに持たせない方針に移行中のため、未設定なら通信せず空のデータを返す
  if (!apiKey || !sheetID) {
    console.warn("スプレッドシートの API キーが未設定のため、データを取得しません");
    return sheetTypes.map((sheetType) => ({ sheetType, data: [] as string[][] }));
  }

  try {
    const responses = await Promise.all(
      sheetTypes.map(async (sheetType) => {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheetType}?key=${apiKey}`
        );
        const json = await response.json();

        if (!json.values) {
          console.warn(`データが無効です (${sheetType})`, json);
          return { sheetType, data: [] };
        }

        return { sheetType, data: json.values };
      })
    );

    return responses;
  } catch (error) {
    console.error(`Google Sheets API エラー:`, error);
    return [];
  }
};

export default fetchSpreadsheetData;