package expo.modules.selectedtext

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * 他のアプリの、文字の選択メニュー（PROCESS_TEXT）と共有（SEND）の受け取り専用の Activity
 *
 * 画面は持たない。届いた文字を、本体の MainActivity に渡して、すぐに閉じる
 * 選択メニューは「結果を返す前提」で起動するため、MainActivity を直接の受け取り先にすると、
 * 呼び出し元（Chrome など）のタスクの中に、2つ目の MainActivity が作られてしまう
 * この Activity は、自分のタスクを持たず（taskAffinity が空）、履歴にも残さない
 */
class CaptureActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    forwardToMainActivity()
    finish()
  }

  /**
   * 文字を送ってきたアプリのパッケージ名（選択メニューは、結果を返す前提で起動されるので callingPackage で分かる）
   * 登録のあとに、このアプリを前面に戻す。自分自身は返さない
   */
  private fun sourcePackage(): String? {
    val caller = callingPackage ?: referrer?.takeIf { it.scheme == "android-app" }?.host
    return caller?.takeIf { it != packageName }
  }

  private fun forwardToMainActivity() {
    val text = SelectedTextIntents.extract(intent, consume = false) ?: return
    // アプリの起動用の Activity（MainActivity）を、名前を決め打ちにせず、システムに尋ねて求める
    val main = packageManager.getLaunchIntentForPackage(packageName)?.component ?: return
    val forward = Intent(SelectedTextIntents.ACTION_CAPTURE).apply {
      component = main
      putExtra(SelectedTextIntents.EXTRA_CAPTURED_TEXT, text)
      sourcePackage()?.let { putExtra(SelectedTextIntents.EXTRA_SOURCE_PACKAGE, it) }
      // 呼び出し元とは別のタスクで、すでに動いている MainActivity を前面に出す（なければ作る）
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(forward)
  }
}
