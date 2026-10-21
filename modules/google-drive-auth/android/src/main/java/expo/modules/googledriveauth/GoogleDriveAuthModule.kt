package expo.modules.googledriveauth

import android.app.Activity
import android.content.IntentSender
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val REQUEST_CODE_AUTHORIZE = 9071

/**
 * 旧 Google Sign-In（非推奨）ではなく、Google が推奨する AuthorizationClient で
 * Drive などのデータアクセス権限を取得するモジュール
 */
class GoogleDriveAuthModule : Module() {
  // 同意画面の結果待ちの Promise（同時に1つだけ）
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("GoogleDriveAuth")

    AsyncFunction("authorize") { scopes: List<String>, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "Activity が取得できません", null)
        return@AsyncFunction
      }
      if (pendingPromise != null) {
        promise.reject("ERR_IN_PROGRESS", "権限の要求がすでに進行中です", null)
        return@AsyncFunction
      }

      val request = AuthorizationRequest.builder()
        .setRequestedScopes(scopes.map { Scope(it) })
        .build()

      Identity.getAuthorizationClient(activity)
        .authorize(request)
        .addOnSuccessListener { result ->
          val pendingIntent = result.pendingIntent
          if (!result.hasResolution() || pendingIntent == null) {
            // 許可済み：同意画面なしでトークンが返る
            promise.resolve(result.toMap())
            return@addOnSuccessListener
          }
          // 未許可：同意画面を出し、結果は OnActivityResult で受け取る
          pendingPromise = promise
          try {
            activity.startIntentSenderForResult(
              pendingIntent.intentSender, REQUEST_CODE_AUTHORIZE, null, 0, 0, 0
            )
          } catch (e: IntentSender.SendIntentException) {
            pendingPromise = null
            promise.reject("ERR_LAUNCH_CONSENT", "同意画面を開けませんでした", e)
          }
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_AUTHORIZE", e.message ?: "権限の取得に失敗しました", e)
        }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != REQUEST_CODE_AUTHORIZE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.reject("ERR_CANCELED", "同意がキャンセルされました", null)
        return@OnActivityResult
      }
      try {
        val result = Identity.getAuthorizationClient(activity)
          .getAuthorizationResultFromIntent(payload.data)
        promise.resolve(result.toMap())
      } catch (e: ApiException) {
        promise.reject("ERR_AUTHORIZE", e.message ?: "権限の取得に失敗しました", e)
      }
    }
  }
}

private fun AuthorizationResult.toMap(): Map<String, Any?> = mapOf(
  "accessToken" to accessToken,
  "grantedScopes" to grantedScopes
)
