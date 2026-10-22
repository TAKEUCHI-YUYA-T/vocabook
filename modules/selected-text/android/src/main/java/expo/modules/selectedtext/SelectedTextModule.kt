package expo.modules.selectedtext

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 他のアプリから届いた「選んだ文字」を、JS に渡すモジュール
 * - 文字の選択メニューの「vocabook」と、共有メニューの「vocabook」は、CaptureActivity が受ける
 * - CaptureActivity が、文字を ACTION_CAPTURE の Intent に入れて MainActivity に渡し、ここで取り出す
 */
class SelectedTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SelectedText")

    // アプリが起動中に、新しい文字が届いたとき
    Events("onSelectedText")

    // アプリが、選んだ文字によって新しく起動されたとき（起動後に1度だけ JS が取りに来る）
    Function("getInitialText") {
      val intent = appContext.currentActivity?.intent
      SelectedTextIntents.extract(intent, consume = true)
    }

    OnNewIntent { intent ->
      val text = SelectedTextIntents.extract(intent, consume = true)
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
}
