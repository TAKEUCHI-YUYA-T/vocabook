
export default {
  expo: {
    name: "vocabook",
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
      package: "com.takeuchi.vocabook",
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
