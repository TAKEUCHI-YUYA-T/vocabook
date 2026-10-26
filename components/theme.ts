/**
 * 画面で使う色（Apple 風。iOS の「設定」のような、薄い灰色の背景と、白いカード）
 * 強調する色は、濃い緑 1 色（primary）。白い文字とのコントラストは 5:1 以上
 */
export const colors = {
  /** 画面の背景（薄い灰色） */
  background: "#F2F2F7",
  /** カード・入力欄の地 */
  surface: "#FFFFFF",
  /** 主な色（主なボタン、リンク、選択中、アイコン）と、その上の文字 */
  primary: "#1F7A3A",
  onPrimary: "#FFFFFF",
  /** 主な色の薄い地（読み上げボタン、下書きの印、覚えたの札など）と、その上の文字 */
  primarySoft: "#E6F2EA",
  onPrimarySoft: "#1F7A3A",
  /** 補足の文字・見出しの小さな文字（灰色） */
  secondary: "#6C6C70",
  /** 副のボタンなどの地（薄い灰色）と、濃い灰色の補足の文字 */
  fill: "#E9E9EE",
  fillStrong: "#E3E3E8",
  textMuted: "#3A3A3C",
  /** 削除などの赤 */
  danger: "#D70015",
  /** 要復習・警告（オレンジ）と、その薄い地 */
  warning: "#C93400",
  warningSoft: "#FFF0E5",
  /** ヒントや注意書きなどの薄い地（カードの上） */
  panel: "#F2F2F7",
  border: "#E5E5EA",
  inputBorder: "#D1D1D6",
  text: "#1C1C1E",
  warningText: "#C93400",
  link: "#1F7A3A",
  /** 区切りのない、薄い青の札（ing or to の印など） */
  info: "#0A60D0",
  /** ホームの入口の、色つきアイコン用 */
  purple: "#5856D6",
  infoSoft: "#E8F0FC",
} as const;

/** 大見出し（一覧・ホーム）と本文の文字の大きさ（iOS の基準） */
export const type = {
  largeTitle: 34,
  title: 17,
  body: 17,
  subhead: 15,
  footnote: 13,
} as const;
