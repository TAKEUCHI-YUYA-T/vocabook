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
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "66976257-69db-4ccf-82f5-ff53bc6c8c70"
      },
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
      GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME
    },
    updates: {
      url: "https://u.expo.dev/66976257-69db-4ccf-82f5-ff53bc6c8c70",
    },
    runtimeVersion: "1.0.0"
  }
};
