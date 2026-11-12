import { migrate } from "@/db/migrations";
import { createTestDb } from "@/db/testing/testDb";
import {
  MIN_INTERVAL_MS,
  MIN_REVEALS,
  readInterstitialHistory,
  recordInterstitialShown,
  recordStudyExit,
  shouldShowInterstitial,
  type InterstitialInput,
} from "../interstitialPolicy";

const base: InterstitialInput = { reveals: MIN_REVEALS, lastShownAt: null, now: 10_000_000, previousExits: 1, loaded: true };

describe("全画面の広告を出す条件", () => {
  it("すべて満たしたとき、出す", () => {
    expect(shouldShowInterstitial(base)).toBe(true);
  });

  it("答えを見た回数が足りなければ、出さない（10 回ちょうどは、出す）", () => {
    expect(shouldShowInterstitial({ ...base, reveals: MIN_REVEALS - 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, reveals: 0 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, reveals: MIN_REVEALS })).toBe(true);
  });

  it("前に出してから 10 分たっていなければ、出さない（ちょうど 10 分は、出す）", () => {
    expect(shouldShowInterstitial({ ...base, lastShownAt: base.now - MIN_INTERVAL_MS + 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, lastShownAt: base.now - MIN_INTERVAL_MS })).toBe(true);
    expect(shouldShowInterstitial({ ...base, lastShownAt: base.now })).toBe(false);
  });

  it("初めての学習の終わりでは、出さない", () => {
    expect(shouldShowInterstitial({ ...base, previousExits: 0 })).toBe(false);
  });

  it("広告の読み込みが済んでいなければ、出さない", () => {
    expect(shouldShowInterstitial({ ...base, loaded: false })).toBe(false);
  });
});

describe("端末に残す記録", () => {
  it("何も記録がなければ、出した時刻なし・抜けた回数 0", async () => {
    const db = await createTestDb();
    await migrate(db);
    expect(await readInterstitialHistory(db)).toEqual({ lastShownAt: null, previousExits: 0 });
  });

  it("学習を抜けた回数と、広告を出した時刻を、記録して読み戻せる", async () => {
    const db = await createTestDb();
    await migrate(db);
    await recordStudyExit(db, 0);
    await recordStudyExit(db, 1);
    await recordInterstitialShown(db, 1_700_000_000_000);
    expect(await readInterstitialHistory(db)).toEqual({ lastShownAt: 1_700_000_000_000, previousExits: 2 });
  });
});
