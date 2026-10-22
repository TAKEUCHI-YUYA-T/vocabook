/** 画面で使う色。画面案（ホーム・学習・単語帳など）と、これまでのアプリの色をそろえている */
export const colors = {
  background: "#fffeef",
  surface: "white",
  /** 主なボタン（黄緑）と、その上の文字 */
  primary: "#9fd700",
  onPrimary: "#446158",
  /** 副のボタン・見出し・アイコン（深緑）と、その上の文字 */
  secondary: "#446158",
  onSecondary: "white",
  danger: "#ff5757",
  /** ヒントや注意書きの背景 */
  panel: "#f3f0d8",
  border: "#ddd",
  inputBorder: "gray",
  text: "black",
  warningText: "#8f5600",
  link: "blue",
} as const;
