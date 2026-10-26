import { requireOptionalNativeModule } from "expo-modules-core";

export type AuthorizationResult = {
  accessToken: string | null;
  grantedScopes: string[];
};

type GoogleDriveAuthModule = {
  /**
   * 指定したスコープの権限を Google に要求し、アクセストークンを返す。
   * 未許可なら同意画面を出し、許可済みなら画面を出さずに有効なトークンを返す。
   */
  authorize(scopes: string[]): Promise<AuthorizationResult>;
};

// iOS は未実装のため null になる
export default requireOptionalNativeModule<GoogleDriveAuthModule>("GoogleDriveAuth");
