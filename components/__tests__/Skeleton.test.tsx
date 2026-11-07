import * as React from "react";
import renderer, { act } from "react-test-renderer";
import { SKELETON_DELAY_MS, useShowAfter } from "../Skeleton";

let shown = false;
function Harness({ active }: { active: boolean }) {
  shown = useShowAfter(active);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("スケルトンを出すタイミング", () => {
  it("読み込みが長引いたときだけ出る。一瞬で終われば、出ない", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness active />);
    });
    expect(shown).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(SKELETON_DELAY_MS - 10);
    });
    expect(shown).toBe(false);
    // 待ち時間の前に読み込みが終わった → 出ないまま
    await act(async () => {
      tree.update(<Harness active={false} />);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(shown).toBe(false);

    await act(async () => {
      tree.update(<Harness active />);
    });
    await act(async () => {
      jest.advanceTimersByTime(SKELETON_DELAY_MS + 10);
    });
    expect(shown).toBe(true);
    // 読み込みが終われば、すぐ消える
    await act(async () => {
      tree.update(<Harness active={false} />);
    });
    expect(shown).toBe(false);
  });
});
