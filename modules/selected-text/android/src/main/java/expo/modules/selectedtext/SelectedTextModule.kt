package expo.modules.selectedtext

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 他のアプリから届いた「選んだ文字」を、JS に渡すモジュール
 * - 文字の選択メニューの「vocabook」と、共有メニューの「vocabook」は、CaptureActivity が受ける
 * - CaptureActivity が、文字を ACTION_CAPTURE の Intent に入れて MainActivity に渡し、ここで取り出す
 */
class SelectedTextModule : Module() {
  /** いま登録しようとしている文字の、送り元のアプリ。登録のあとに、そのアプリを前面に戻す */
  private var sourcePackage: String? = null

  override fun definition() = ModuleDefinition {
    Name("SelectedText")

    // アプリが起動中に、新しい文字が届いたとき
    Events("onSelectedText")

    // アプリが、選んだ文字によって新しく起動されたとき（起動後に1度だけ JS が取りに来る）
    Function("getInitialText") {
      val intent = appContext.currentActivity?.intent
      val text = SelectedTextIntents.extract(intent, consume = true)
      if (text != null) sourcePackage = SelectedTextIntents.sourcePackage(intent)
      text
    }

    OnNewIntent { intent ->
      val text = SelectedTextIntents.extract(intent, consume = true)
      if (text != null) {
        sourcePackage = SelectedTextIntents.sourcePackage(intent)
        sendEvent("onSelectedText", mapOf("text" to text))
      }
    }

    // 登録のあと、元のアプリ（選択元）に戻る
    Function("returnToPreviousApp") {
      val activity = appContext.currentActivity
      val source = sourcePackage
      sourcePackage = null
      returnTo(activity, source)
      null
    }
  }

  /**
   * 送り元のアプリを前面に出す（アプリのアイコンを押したときと同じ。前の画面のまま戻る）
   * moveTaskToBack だけでは、端末によって元のアプリではなく、ホーム画面に戻ってしまうため、
   * 送り元が分かるときは、そのアプリを直接開く。開けなければ、これまでどおり moveTaskToBack で戻る
   */
  private fun returnTo(activity: Activity?, source: String?) {
    if (activity == null) return
    val launch = source?.let { activity.packageManager.getLaunchIntentForPackage(it) }
    if (launch != null) {
      try {
        activity.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return
      } catch (e: Exception) {
        // 開けなかったときは、下の moveTaskToBack で戻る
      }
    }
    activity.moveTaskToBack(true)
  }
}
