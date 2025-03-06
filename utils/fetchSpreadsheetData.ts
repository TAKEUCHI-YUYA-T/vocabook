export const fetchSpreadsheetData = async (sheetTypes: string[]) => {
  try {
    const responses = await Promise.all(
      sheetTypes.map(async (sheetType) => {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/1_qAyYwxy-iEhJjsRWf8jaAmloc-ixYG2FRcH14Gg7zg/values/${sheetType}?key=AIzaSyAtFydjUf60nfPhC2FJuyV9QQfHANcJlnY`
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