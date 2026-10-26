/**
 * アプリが使っているライブラリ（package.json の dependencies）の名前・版・ライセンスを一覧にする
 * アプリの「このアプリについて」画面に表示する（オープンソースの表示義務のため）
 *
 * 使い方: node scripts/build-licenses.js
 * 出力: assets/licenses.json
 * 依存を足したり更新したら、実行し直す
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const licenseOf = (info) => {
  if (typeof info.license === "string") return info.license;
  if (info.license && typeof info.license.type === "string") return info.license.type;
  if (Array.isArray(info.licenses)) return info.licenses.map((l) => l.type).join(" OR ");
  return "";
};

const list = [];
const missing = [];
for (const name of Object.keys(pkg.dependencies ?? {}).sort()) {
  const file = path.join(ROOT, "node_modules", name, "package.json");
  if (!fs.existsSync(file)) {
    missing.push(name);
    continue;
  }
  const info = JSON.parse(fs.readFileSync(file, "utf8"));
  const license = licenseOf(info);
  if (!license) missing.push(`${name}（ライセンスの記載なし）`);
  list.push({ name, version: info.version, license: license || "不明" });
}

const out = path.join(ROOT, "assets", "licenses.json");
fs.writeFileSync(out, JSON.stringify(list, null, 1) + "\n");
const kinds = {};
for (const item of list) kinds[item.license] = (kinds[item.license] ?? 0) + 1;
console.log(`${list.length} 件 → ${path.relative(ROOT, out)}`);
console.log("ライセンスの種類:", JSON.stringify(kinds));
if (missing.length) console.log("確認が必要:", missing.join("、"));
