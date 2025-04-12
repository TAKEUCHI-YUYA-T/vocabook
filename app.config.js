import "dotenv/config";

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
      "expo-splash-screen"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "66976257-69db-4ccf-82f5-ff53bc6c8c70"
      },
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      SPREAD_SHEET_ID: process.env.SPREAD_SHEET_ID
    },
    updates: {
      url: "https://u.expo.dev/66976257-69db-4ccf-82f5-ff53bc6c8c70",
    },
    runtimeVersion: "1.0.0"
  }
};
