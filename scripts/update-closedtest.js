/**
 * クローズドテスト版（テスト広告・チャンネル closedtest）に、アプリの更新（EAS Update）を配信する
 *
 * 使い方: node scripts/update-closedtest.js "更新のメッセージ"
 *
 * 更新の中身は、ビルドと同じ環境変数で作る必要がある。広告のアプリ ID は、アプリの設定に入るので、違うとアプリの版（runtimeVersion）が合わず、届かない。
 * 広告ユニットの ID は、JS に埋め込まれるので、違うと本番の広告が出てしまう。
 * そのため、eas.json の closedtest（と、その元の production）の env を読んで、付けて実行する（ID を手で打たない）
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const message = process.argv[2] || "update";
const eas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "eas.json"), "utf8"));
const profile = eas.build.closedtest;
const base = profile.extends ? eas.build[profile.extends] : {};
const env = { ...(base.env || {}), ...(profile.env || {}) };

const result = spawnSync("npx", ["eas-cli", "update", "--channel", profile.channel, "--platform", "android", "--message", JSON.stringify(message), // shell 経由で実行するので、空白を含むメッセージは、引用符で囲む
    "--non-interactive"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ...env },
});
process.exit(result.status ?? 1);
