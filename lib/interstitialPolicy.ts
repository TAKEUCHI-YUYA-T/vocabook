import type { Db } from "@/db/database";

/**
 * 全画面の広告（インタースティシャル）を出す条件
 * 学習と ing or to で、左上の戻る（端末の戻る操作も同じ）を押したときだけ、次の条件をすべて満たせば出す
 * - その回の学習で、答えを 10 回以上見た（少しだけ見て戻る人には、出さない）
 * - 前に出してから、10 分以上たっている（閉じた直後に、続けて出すのは、規約で禁止）
 * - 初めての学習の終わりではない（初めて使ったときの印象を守る）
 * - 広告の読み込みが済んでいる（済んでいなければ、待たずに戻る）
 * アプリを開いたとき・学習の途中・単語の追加や編集・設定では、出さない（そもそも、この判定を呼ばない）
 */

/** 出すために必要な、答えを見た回数 */
export const MIN_REVEALS = 10;
/** 前に出してから、次に出すまでの、最短の間隔 */
export const MIN_INTERVAL_MS = 10 * 60 * 1000;
/** 「Please wait...」を、最低限見せる時間（突然、広告が出ないように） */
export const WAIT_BEFORE_AD_MS = 1000;
/** 戻るを押してから、広告が出るのを待つ、最長の時間（これを過ぎても出なければ、広告なしで戻る） */
export const MAX_WAIT_MS = 3000;

export const META_AD_LAST_SHOWN = "interstitial_last_shown";
export const META_STUDY_EXITS = "study_exits";

export type InterstitialInput = {
  /** その回の学習で、答えを見た回数 */
  reveals: number;
  /** 前に広告を出した時刻（ms）。まだ出していなければ null */
  lastShownAt: number | null;
  /** いま（ms） */
  now: number;
  /** これまでに、学習の画面を抜けた回数（今回の分は含まない） */
  previousExits: number;
  /** 広告の読み込みが済んでいるか */
  loaded: boolean;
};

export function shouldShowInterstitial({ reveals, lastShownAt, now, previousExits, loaded }: InterstitialInput): boolean {
  if (!loaded) return false;
  if (reveals < MIN_REVEALS) return false;
  if (previousExits < 1) return false;
  if (lastShownAt !== null && now - lastShownAt < MIN_INTERVAL_MS) return false;
  return true;
}

const getMeta = async (db: Db, key: string): Promise<string | null> =>
  (await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))?.value ?? null;
const setMeta = (db: Db, key: string, value: string) =>
  db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);

/** 判定に使う、端末に残した記録（前に広告を出した時刻・学習の画面を抜けた回数） */
export async function readInterstitialHistory(db: Db): Promise<{ lastShownAt: number | null; previousExits: number }> {
  const [last, exits] = await Promise.all([getMeta(db, META_AD_LAST_SHOWN), getMeta(db, META_STUDY_EXITS)]);
  const lastNumber = last === null ? NaN : Number(last);
  const exitsNumber = exits === null ? NaN : Number(exits);
  return {
    lastShownAt: Number.isFinite(lastNumber) ? lastNumber : null,
    previousExits: Number.isFinite(exitsNumber) && exitsNumber > 0 ? exitsNumber : 0,
  };
}

/** 学習の画面を抜けたことを、記録する */
export async function recordStudyExit(db: Db, previousExits: number): Promise<void> {
  await setMeta(db, META_STUDY_EXITS, String(previousExits + 1));
}

/** 広告を出したことを、記録する */
export async function recordInterstitialShown(db: Db, at: number): Promise<void> {
  await setMeta(db, META_AD_LAST_SHOWN, String(at));
}
