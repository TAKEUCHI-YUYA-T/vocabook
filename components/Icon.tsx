import { createIconSet } from "@expo/vector-icons";
import glyphMap from "../assets/fonts/lucide-glyphs.json";

/**
 * アイコンは、Lucide（https://lucide.dev）に統一する
 * アイコンのフォント（assets/fonts/lucide.ttf）と、使う名前の一覧（lucide-glyphs.json）をアプリに同梱している
 * 新しいアイコンを使うときは、lucide-static の codepoints.json から、名前と番号を lucide-glyphs.json に足す
 */
export type IconName = keyof typeof glyphMap;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Icon = createIconSet(glyphMap, "lucide", require("../assets/fonts/lucide.ttf"));
