import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { SelectedTextRouter } from '@/components/SelectedTextRouter';
import { colors } from '@/components/theme';
import { AppDatabase } from '@/db/AppDatabase';
import { useColorScheme } from '@/hooks/useColorScheme';
import { scheduleDailyReminder } from '@/lib/reminder';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // 毎朝 8:00 の学習の通知を予約する（許可がまだなら、起動時に1度、許可を求める。何度呼んでも、予約は1件だけ）
  useEffect(() => {
    scheduleDailyReminder();
  }, []);

  // スプラッシュ画面は、DB の準備ができた時点で AppDatabase が閉じる
  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppDatabase>
        <SelectedTextRouter />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppDatabase>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
