import licenses from "../../assets/licenses.json";
import wordnet from "../../assets/dictionary/wordnet-license.json";

type License = { name: string; version: string; license: string; text: string; textFrom?: string };
const list = licenses as License[];

describe("ライセンスの一覧（assets/licenses.json。scripts/build-licenses.js で作る）", () => {
  it("どの項目にも、名前・版・ライセンスの種類・本文がある（MIT などは、本文を載せる必要がある）", () => {
    expect(list.length).toBeGreaterThan(30);
    for (const item of list) {
      expect(item.name).toBeTruthy();
      expect(item.version).toBeTruthy();
      expect(item.license).toBeTruthy();
      expect(item.text.length).toBeGreaterThan(100);
    }
  });

  it("アプリに入らない部品（テスト用・Web 用・型だけ）は、載せない", () => {
    const names = new Set(list.map((item) => item.name));
    for (const name of ["jest-expo", "jest", "@types/react", "react-dom", "react-native-web", "dotenv", "typescript", "sql.js"]) {
      expect(names.has(name)).toBe(false);
    }
  });

  it("アプリの中心の部品と、ネイティブで組み込まれる部品（広告など）は、載っている", () => {
    const names = new Set(list.map((item) => item.name));
    for (const name of ["react", "react-native", "expo", "expo-router", "expo-sqlite", "react-native-google-mobile-ads", "papaparse"]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it("同じ名前・版の重複がなく、名前の順に並んでいる", () => {
    const keys = list.map((item) => `${item.name}@${item.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    expect(list.map((item) => item.name)).toEqual(sorted.map((item) => item.name));
  });

  it("WordNet のライセンスの全文がある（データの写しには、必ず添える条件）", () => {
    expect(wordnet.name).toBe("WordNet 3.0");
    expect(wordnet.text).toContain("Princeton University");
    expect(wordnet.text.length).toBeGreaterThan(1000);
  });
});
