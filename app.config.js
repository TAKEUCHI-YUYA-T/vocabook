
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
