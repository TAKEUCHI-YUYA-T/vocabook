/**
 * 広告ユニット ID の選び方（ネイティブの部品に依存しない。テストできるよう、分けてある）
 * - 本番の ID が設定されたリリースビルドだけ、本番の広告を出す
 * - 開発中や、ID が未設定のビルドは、Google のテスト広告を出す
 *   （自分の広告を、開発中に押すと、不正なクリックとして、アカウントが止められるため）
 */
export function pickBannerUnitId(options: { isDev: boolean; productionId: string | undefined; testId: string }): string {
  const production = options.productionId?.trim();
  return !options.isDev && production ? production : options.testId;
}

/** バナーの高さ（320×50 の標準サイズ）。広告の場所を先に確保して、広告が出たときに画面がずれないようにする */
export const BANNER_HEIGHT = 50;
