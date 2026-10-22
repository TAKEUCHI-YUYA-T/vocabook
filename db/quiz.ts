/**
 * 出題の順番の管理（画面から切り離して、テストできるようにしている）
 */

/** Fisher–Yates シャッフル。元の配列は変更しない。random はテストで差し替えられる */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type QuizState<T> = {
  /** 出題順に並べた問題 */
  order: T[];
  /** いま何問目か（0 始まり） */
  index: number;
  /** 一巡して、シャッフルし直した回数 */
  rounds: number;
};

export function startQuiz<T>(items: readonly T[], random: () => number = Math.random): QuizState<T> {
  return { order: shuffle(items, random), index: 0, rounds: 0 };
}

/**
 * 次の問題へ進む。最後まで行ったら、シャッフルし直して最初に戻る
 * ただし、シャッフルし直した直後に、直前の問題が先頭に来る場合は、入れ替えて連続を避ける
 */
export function nextQuestion<T>(state: QuizState<T>, random: () => number = Math.random): QuizState<T> {
  if (state.order.length === 0) return state;
  if (state.index + 1 < state.order.length) return { ...state, index: state.index + 1 };

  const last = state.order[state.order.length - 1];
  const reshuffled = shuffle(state.order, random);
  if (reshuffled.length > 1 && reshuffled[0] === last) {
    [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
  }
  return { order: reshuffled, index: 0, rounds: state.rounds + 1 };
}

/** 進捗の表示用（「問題 3 / 20（15%）」の数字） */
export function progress<T>(state: QuizState<T>): { current: number; total: number; percent: number } {
  const total = state.order.length;
  if (total === 0) return { current: 0, total: 0, percent: 0 };
  const current = state.index + 1;
  return { current, total, percent: Math.round((current / total) * 100) };
}
