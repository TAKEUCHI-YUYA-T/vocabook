const fs = require("fs");
const path = require("path");
const { withDangerousMod, withGradleProperties } = require("expo/config-plugins");

const MARKER = "# vocabook: keep rules for on-device translation (ML Kit)";

/**
 * リリースビルドの R8（コードの圧縮・難読化）が、ML Kit の翻訳の内部クラスを改名・削除すると、
 * 翻訳器を作る時点で NullPointerException になる（開発用ビルドでは起きない）。
 * ML Kit の翻訳が使うクラスを、圧縮の対象から外す
 */
const RULES = `
${MARKER}
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class expo.modules.translatetext.** { *; }
-dontwarn com.google.mlkit.**
`;

/**
 * 1. リリースビルドの R8 による圧縮・難読化を止める（個人用の APK では、サイズの差はわずか）
 *    ストアに出す前に、true に戻して、翻訳などが動くことを確かめ直す
 * 2. android/app/proguard-rules.pro に、ML Kit の keep ルールを足す（すでに足してあれば何もしない）
 */
module.exports = function withProguardRules(config) {
  config = withGradleProperties(config, (cfg) => {
    const key = "android.enableMinifyInReleaseBuilds";
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === "property" && item.key === key));
    cfg.modResults.push({ type: "property", key, value: "false" });
    return cfg;
  });

  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (!current.includes(MARKER)) {
        fs.writeFileSync(file, current.replace(/\s*$/, "\n") + RULES);
      }
      return cfg;
    },
  ]);
};
