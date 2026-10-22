/**
 * 他のアプリから「選んだ文字」を受け取れるよう、MainActivity に受け取り設定（intent-filter）を足す
 *  - 共有メニューの「vocabook」: ACTION_SEND（text/plain）
 *  - 文字の選択メニューの「vocabook」: ACTION_PROCESS_TEXT（text/plain）
 * 同じ設定が、すでにあれば足さない（何度実行しても、重複しない）
 */
const { withAndroidManifest } = require("expo/config-plugins");

const FILTERS = [
  { action: "android.intent.action.SEND", mimeType: "text/plain" },
  { action: "android.intent.action.PROCESS_TEXT", mimeType: "text/plain" },
];

const hasFilter = (activity, { action, mimeType }) =>
  (activity["intent-filter"] ?? []).some(
    (filter) =>
      (filter.action ?? []).some((a) => a.$["android:name"] === action) &&
      (filter.data ?? []).some((d) => d.$["android:mimeType"] === mimeType)
  );

module.exports = function withSelectedText(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    const activity = application?.activity?.find((a) => a.$["android:name"] === ".MainActivity");
    if (!activity) {
      throw new Error("withSelectedText: AndroidManifest に MainActivity が見つかりません");
    }
    activity["intent-filter"] = activity["intent-filter"] ?? [];
    for (const filter of FILTERS) {
      if (hasFilter(activity, filter)) continue;
      activity["intent-filter"].push({
        action: [{ $: { "android:name": filter.action } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": filter.mimeType } }],
      });
    }
    return modConfig;
  });
};
