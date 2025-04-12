import Constants from "expo-constants";
const apiKey = Constants.expoConfig?.extra?.GOOGLE_API_KEY;
const sheetID = Constants.expoConfig?.extra?.SPREAD_SHEET_ID;

export const fetchSpreadsheetData = async (sheetTypes: string[]) => {
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