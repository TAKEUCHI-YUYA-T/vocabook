
/**
 * ビルドの種類（環境変数 APP_VARIANT）
 * - personal: 自分用。広告なし。今の端末のデータをそのまま使えるよう、これまでのパッケージ名のまま（Play には出さない）
 * - それ以外（ふつう）: ストア用。広告あり。新しいパッケージ名（Play に最初に出す前に決める。出したあとは変えられない）
 */
const isPersonal = process.env.APP_VARIANT === "personal";
const STORE_PACKAGE = "com.takeuchi.vocabook.store";
const PERSONAL_PACKAGE = "com.takeuchi.vocabook";

export default {
  expo: {
    name: isPersonal ? "vocabook 自分用" : "vocabook",
    slug: "vocabook",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "y.takeuchi",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.y.takeuchi.vocabook",
      icon: "./assets/images/app-icon-ios.png"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/app-icon-android.png",
        backgroundColor: "#ffffff"
      },
      package: isPersonal ? PERSONAL_PACKAGE : STORE_PACKAGE,
      // 使っていない権限は、ストアの審査で説明が要るので、外す（ファイルの取り込みは、端末の選択画面を使うので、保存領域の権限は要らない）
      blockedPermissions: [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ],
      icon: "./assets/images/app-icon-android.png"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
      devServer: {
        "port": 8080
      }
    },
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#fffeef"
    },
    plugins: [
      "expo-router",
      "expo-splash-screen",
      "expo-sqlite",
      "expo-sharing",
      // 毎朝の学習の通知（端末の中で予約する）。通知の色は、アプリの深緑
      ["expo-notifications", { color: "#446158" }],
      // 広告（Google AdMob）。アプリ ID は、本番ビルドでは環境変数 ADMOB_ANDROID_APP_ID で渡す（未設定なら、Google のテスト用の ID）
      [
        "react-native-google-mobile-ads",
        { androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713" }
      ],
      "./plugins/withProguardRules"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      // 広告を出すか（自分用のビルドは、広告なし）
      adsEnabled: !isPersonal,
      eas: {
        projectId: "66976257-69db-4ccf-82f5-ff53bc6c8c70"
      },
    },
    updates: {
      url: "https://u.expo.dev/66976257-69db-4ccf-82f5-ff53bc6c8c70",
    },
    runtimeVersion: {
      policy: "fingerprint"
    }
  }
};
