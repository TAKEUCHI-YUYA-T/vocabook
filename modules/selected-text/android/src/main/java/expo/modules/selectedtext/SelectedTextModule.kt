package expo.modules.selectedtext

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 他のアプリから届いた「選んだ文字」を、JS に渡すモジュール
 * - 文字の選択メニューの「vocabook」（ACTION_PROCESS_TEXT）
 * - 共有メニューの「vocabook」（ACTION_SEND, text/plain）
 * の2つの経路に対応する
 *
 * 届く文字は、他のアプリが自由に作れる、信頼できない入力として扱う
 * ここでは長さの上限だけを適用し、意味づけや解釈は JS 側で慎重に行う
 */
class SelectedTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SelectedText")

    // アプリが起動中に、新しい文字が届いたとき
    Events("onSelectedText")

    // アプリが、選んだ文字によって新しく起動されたとき（起動後に1度だけ JS が取りに来る）
    Function("getInitialText") {
      val intent = appContext.currentActivity?.intent
      extractText(intent, consume = true)
    }

    OnNewIntent { intent ->
      val text = extractText(intent, consume = true)
      if (text != null) {
        sendEvent("onSelectedText", mapOf("text" to text))
      }
    }

    // 登録のあと、元のアプリ（選択元）に戻る
    Function("returnToPreviousApp") {
      appContext.currentActivity?.moveTaskToBack(true)
      null
    }
  }

  /**
   * Intent から選んだ文字を取り出す。該当しない Intent なら null
   * consume が true なら、同じ文字を二度処理しないよう、Intent から文字を取り除く
   */
  private fun extractText(intent: Intent?, consume: Boolean): String? {
    if (intent == null) return null
    val raw: CharSequence? = when (intent.action) {
      Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
      Intent.ACTION_SEND -> if (intent.type?.startsWith("text/") == true) intent.getCharSequenceExtra(Intent.EXTRA_TEXT) else null
      else -> null
    }
    if (consume) {
      when (intent.action) {
        Intent.ACTION_PROCESS_TEXT -> intent.removeExtra(Intent.EXTRA_PROCESS_TEXT)
        Intent.ACTION_SEND -> intent.removeExtra(Intent.EXTRA_TEXT)
      }
    }
    val text = raw?.toString()?.trim()
    if (text.isNullOrEmpty()) return null
    return if (text.length > MAX_LENGTH) text.substring(0, MAX_LENGTH) else text
  }

  companion object {
    /** 受け取る文字の長さの上限。長い文章が送られても、アプリが重くならないようにする */
    private const val MAX_LENGTH = 2000
  }
}
