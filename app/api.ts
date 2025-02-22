// export async function fetchSpreadsheetData() {
//   try {
//     const response = await fetch("http://localhost:3001/api/google-sheets");
//     const data = await response.json();
//     console.log("スプレッドシートのデータ:", data);
//     return data.data; // "reference" シートのB1セルの値
//   } catch (error) {
//     console.error("API エラー:", error);
//     return "エラー";
//   }
// }


export async function fetchSpreadsheetData() {
  try {
    const response = await fetch("http://localhost:3001/api/google-sheets");
    const data = await response.json();
    console.log("スプレッドシートのデータ:", data);
    return data.data; // すべてのデータを配列で返す
  } catch (error) {
    console.error("API エラー:", error);
    return [];
  }
}
