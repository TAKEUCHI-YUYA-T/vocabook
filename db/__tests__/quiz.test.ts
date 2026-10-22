import { nextQuestion, progress, shuffle, startQuiz } from "../quiz";

/** 毎回同じ並びになる、テスト用の乱数 */
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe("出題の管理", () => {
  it("シャッフルしても要素は増減せず、元の配列は変わらない", () => {
    const original = [1, 2, 3, 4, 5, 6];
    const result = shuffle(original, seeded());
    expect([...result].sort()).toEqual(original);
    expect(original).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("最後まで進むと、シャッフルし直して最初に戻り、回数が増える", () => {
    let state = startQuiz(["a", "b", "c"], seeded());
    const seen = [state.order[state.index]];
    state = nextQuestion(state, seeded(2));
    seen.push(state.order[state.index]);
    state = nextQuestion(state, seeded(3));
    seen.push(state.order[state.index]);
    expect([...seen].sort()).toEqual(["a", "b", "c"]);

    state = nextQuestion(state, seeded(4));
    expect(state).toMatchObject({ index: 0, rounds: 1 });
    expect(state.order).toHaveLength(3);
  });

  it("一巡の境目で、同じ問題が続けて出ない", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let state = startQuiz(["a", "b", "c", "d"], seeded(seed));
      const last = () => state.order[state.index];
      for (let i = 0; i < 3; i++) state = nextQuestion(state, seeded(seed + 1000));
      const before = last();
      state = nextQuestion(state, seeded(seed + 2000));
      expect(state.order[0]).not.toBe(before);
    }
  });

  it("問題が空・1問だけでも壊れない", () => {
    const empty = startQuiz<string>([]);
    expect(nextQuestion(empty)).toEqual(empty);
    expect(progress(empty)).toEqual({ current: 0, total: 0, percent: 0 });

    const one = nextQuestion(startQuiz(["only"]));
    expect(one.order).toEqual(["only"]);
    expect(one.index).toBe(0);
  });

  it("進捗を、現在の問題番号と割合で返す", () => {
    const state = { order: [1, 2, 3, 4], index: 2, rounds: 0 };
    expect(progress(state)).toEqual({ current: 3, total: 4, percent: 75 });
  });
});
