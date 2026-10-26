/**
 * 自分用の版（広告なし・チャンネル personal）に、アプリの更新（EAS Update）を配信する
 *
 * 使い方: node scripts/update-personal.js "更新のメッセージ"
 *
 * 自分用の版は、環境変数 APP_VARIANT=personal で、設定が変わる（パッケージ名・広告なし）。
 * 更新の配信でも、同じ設定で計算しないと、アプリの版（runtimeVersion）が合わず、届かない。そのため、この環境変数を付けて実行する
 */
const { spawnSync } = require("child_process");

const message = process.argv[2] || "update";
const result = spawnSync("npx", ["eas-cli", "update", "--channel", "personal", "--platform", "android", "--message", JSON.stringify(message), // shell 経由で実行するので、空白を含むメッセージは、引用符で囲む
    "--non-interactive"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, APP_VARIANT: "personal" },
});
process.exit(result.status ?? 1);
