package expo.modules.selectedtext

import android.content.Intent

/**
 * 「選んだ文字」を運ぶ Intent の読み書きをまとめたもの
 *
 * 他のアプリの共有・選択メニューは、受け取り専用の CaptureActivity が受ける。
 * CaptureActivity は、文字を ACTION_CAPTURE の Intent に入れて、本体の MainActivity に渡す
 * （MainActivity が直接受けると、Android が、呼び出し元のタスクの中に、2つ目の MainActivity を作ってしまうため）
 */
object SelectedTextIntents {
  /** CaptureActivity から MainActivity へ、選んだ文字を渡すための、アプリ内だけの Action */
  const val ACTION_CAPTURE = "com.takeuchi.vocabook.action.CAPTURE"
  const val EXTRA_CAPTURED_TEXT = "com.takeuchi.vocabook.extra.CAPTURED_TEXT"

  /** 受け取る文字の長さの上限。長い文章が送られても、アプリが重くならないようにする */
  const val MAX_LENGTH = 2000

  /**
   * Intent から選んだ文字を取り出す。該当しない Intent なら null
   * consume が true なら、同じ文字を二度処理しないよう、Intent から文字を取り除く
   * 届く文字は、他のアプリが自由に作れる、信頼できない入力として扱う（長さの上限だけをここで適用する）
   */
  fun extract(intent: Intent?, consume: Boolean): String? {
    if (intent == null) return null
    val raw: CharSequence? = when (intent.action) {
      ACTION_CAPTURE -> intent.getStringExtra(EXTRA_CAPTURED_TEXT)
      Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
      Intent.ACTION_SEND -> if (intent.type?.startsWith("text/") == true) intent.getCharSequenceExtra(Intent.EXTRA_TEXT) else null
      else -> null
    }
    if (consume) {
      when (intent.action) {
        ACTION_CAPTURE -> intent.removeExtra(EXTRA_CAPTURED_TEXT)
        Intent.ACTION_PROCESS_TEXT -> intent.removeExtra(Intent.EXTRA_PROCESS_TEXT)
        Intent.ACTION_SEND -> intent.removeExtra(Intent.EXTRA_TEXT)
      }
    }
    val text = raw?.toString()?.trim()
    if (text.isNullOrEmpty()) return null
    return if (text.length > MAX_LENGTH) text.substring(0, MAX_LENGTH) else text
  }
}
