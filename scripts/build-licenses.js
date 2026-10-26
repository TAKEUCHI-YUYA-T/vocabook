/**
 * アプリに入っているライブラリの一覧（名前・版・ライセンスの種類と本文）を作る。「ライセンス」の画面に表示する
 * MIT などのライセンスは、著作権の表示とライセンスの本文を、配布物に含めるよう求めているため、本文も載せる
 *
 * 使い方: node scripts/build-licenses.js
 * 出力: assets/licenses.json
 *
 * 「アプリに入っているもの」だけを拾う（テスト用・Web 用など、アプリに入らない部品は載せない）
 * 1. JavaScript: Android 用に束ねて（expo export）、ソースマップに出てくる npm のパッケージ
 * 2. ネイティブ: Android のアプリに自動で組み込まれる部品（Expo の部品と、React Native の部品）
 * 依存を足したり、更新したりしたら、実行し直す
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "licenses.json");
const EXPORT_DIR = path.join(os.tmpdir(), "vocabook-license-export");
/** 自分で作った部品（ライセンスの表示は不要） */
const OWN_PACKAGES = new Set(["selected-text"]);

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: ROOT, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} に失敗しました\n${result.stderr}`);
  return result.stdout;
};

/** パスの中の、最後の node_modules のパッケージの場所（パッケージの外のファイルなら null） */
function packageRootOf(source) {
  const p = source.replace(/\\/g, "/");
  const marker = "node_modules/";
  const at = p.lastIndexOf(marker);
  if (at < 0) return null;
  const rest = p.slice(at + marker.length).split("/");
  const name = rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
  return p.slice(0, at + marker.length + name.length);
}

/** 1. 束ねた JavaScript に入っているパッケージの場所 */
function bundledPackageDirs() {
  fs.rmSync(EXPORT_DIR, { recursive: true, force: true });
  run("npx", ["expo", "export", "--platform", "android", "--source-maps", "true", "--output-dir", JSON.stringify(EXPORT_DIR)]);
  const maps = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".map")) maps.push(full);
    }
  };
  walk(EXPORT_DIR);
  if (maps.length === 0) throw new Error("ソースマップが見つかりません");
  const dirs = new Set();
  for (const map of maps) {
    const { sources = [] } = JSON.parse(fs.readFileSync(map, "utf8"));
    for (const source of sources) {
      const root = packageRootOf(source);
      if (!root) continue;
      // ソースマップのパスは、プロジェクトのフォルダからの位置（"/node_modules/..."）で書かれている
      const candidates = [path.join(ROOT, root.replace(/^\/+/, "")), root];
      const found = candidates.find((dir) => fs.existsSync(path.join(dir, "package.json")));
      if (found) dirs.add(path.resolve(found));
    }
  }
  fs.rmSync(EXPORT_DIR, { recursive: true, force: true });
  return dirs;
}

/** 2. Android のアプリに自動で組み込まれる、ネイティブの部品の名前 */
function nativePackageNames() {
  const expo = JSON.parse(run("npx", ["expo-modules-autolinking", "resolve", "--platform", "android", "--json"]));
  const community = JSON.parse(run("npx", ["expo-modules-autolinking", "react-native-config", "--platform", "android", "--json"]));
  const names = new Set((expo.modules ?? []).map((m) => m.packageName));
  for (const [name, value] of Object.entries(community.dependencies ?? {})) {
    if (value?.platforms?.android) names.add(name);
  }
  return names;
}

const licenseOf = (info) => {
  if (typeof info.license === "string") return info.license;
  if (info.license && typeof info.license.type === "string") return info.license.type;
  if (Array.isArray(info.licenses)) return info.licenses.map((l) => l.type).join(" OR ");
  return "";
};

/** パッケージの中の、ライセンスのファイルの本文（LICENSE、LICENSE.md、LICENCE、COPYING など。なければ空） */
function licenseText(dir) {
  const files = fs.readdirSync(dir).filter((name) => /^(licen[cs]e|copying)([-._].*)?$/i.test(name));
  files.sort((a, b) => a.length - b.length);
  for (const name of files) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isFile()) return fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n").trim();
  }
  return "";
}

const dirs = bundledPackageDirs();
const bundledCount = dirs.size;
for (const name of nativePackageNames()) {
  if (OWN_PACKAGES.has(name)) continue;
  const dir = path.join(ROOT, "node_modules", name);
  if (fs.existsSync(path.join(dir, "package.json"))) dirs.add(path.resolve(dir));
}

const byKey = new Map();
for (const dir of dirs) {
  const info = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  if (!info.name || OWN_PACKAGES.has(info.name) || info.name === "vocabook") continue;
  const key = `${info.name}@${info.version}`;
  if (byKey.has(key)) continue;
  byKey.set(key, { name: info.name, version: info.version ?? "", license: licenseOf(info) || "不明", text: licenseText(dir) });
}

/** リポジトリの URL を、比べられる形にする（git+、.git、ssh の書き方の違いをそろえる） */
const normalizeRepo = (info) => {
  const raw = typeof info.repository === "string" ? info.repository : info.repository?.url;
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/^git\+/, "")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
};

/**
 * ライセンスのファイルがないパッケージの本文を補う
 * 1. 同じリポジトリ（React Native、Expo、Metro など）から配られているパッケージの、ライセンスのファイル
 * 2. それもなく、MIT なら、package.json の記載（作者）に基づく MIT の標準の文面（その旨を書き添える）
 */
const MIT_TEMPLATE = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const repoTexts = new Map();
const addRepoText = (dir) => {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const repo = normalizeRepo(info);
    if (!repo || repoTexts.has(repo)) return;
    const text = licenseText(dir);
    if (text) repoTexts.set(repo, { text, from: info.name });
  } catch {
    // package.json の読めないフォルダは、飛ばす
  }
};
const nodeModules = path.join(ROOT, "node_modules");
for (const entry of fs.readdirSync(nodeModules)) {
  if (entry.startsWith(".")) continue;
  if (entry.startsWith("@")) {
    for (const sub of fs.readdirSync(path.join(nodeModules, entry))) addRepoText(path.join(nodeModules, entry, sub));
  } else {
    addRepoText(path.join(nodeModules, entry));
  }
}

for (const [key, item] of byKey) {
  if (item.text) continue;
  const dir = [...dirs].find((d) => {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8"));
      return `${info.name}@${info.version}` === key;
    } catch {
      return false;
    }
  });
  const info = dir ? JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) : {};
  const sameRepo = repoTexts.get(normalizeRepo(info));
  if (sameRepo) {
    item.text = sameRepo.text;
    item.textFrom = sameRepo.from;
  } else if (/^MIT$/i.test(item.license)) {
    const author = typeof info.author === "string" ? info.author.replace(/\s*<[^>]*>/, "") : info.author?.name;
    item.text = MIT_TEMPLATE(author || `the ${item.name} authors`);
    item.textFrom = "package.json";
  }
}

const list = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
fs.writeFileSync(OUT, JSON.stringify(list, null, 1) + "\n");

const kinds = {};
for (const item of list) kinds[item.license] = (kinds[item.license] ?? 0) + 1;
const missing = list.filter((item) => !item.text).map((item) => `${item.name}（${item.license}）`);
console.log(`${list.length} 件（JavaScript から ${bundledCount} 件、ネイティブを合わせて）→ ${path.relative(ROOT, OUT)}（${Math.round(fs.statSync(OUT).size / 1024)} KB）`);
console.log("ライセンスの種類:", JSON.stringify(kinds));
console.log(`本文のファイルがない: ${missing.length} 件${missing.length ? "\n  " + missing.join("、") : ""}`);
