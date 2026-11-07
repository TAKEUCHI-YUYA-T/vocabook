import * as React from "react";
import { Text, TouchableOpacity } from "react-native";
import renderer, { act } from "react-test-renderer";
import { TOAST_MS, TOAST_WITH_ACTION_MS, ToastProvider, useToast, type ToastOptions } from "../Toast";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../Icon", () => ({ Icon: () => null }));

let api!: ReturnType<typeof useToast>;
function Harness() {
  api = useToast();
  return null;
}

const texts = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Text).map((node) => String(node.props.children));

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );
  });
  return tree;
};

const show = async (options: ToastOptions) => {
  await act(async () => {
    api.show(options);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("トースト", () => {
  it("結果の文章を出して、時間がたつと消える", async () => {
    const tree = await mount();
    expect(texts(tree)).toEqual([]);
    await show({ message: "「concern」を追加しました" });
    expect(texts(tree)).toEqual(["「concern」を追加しました"]);
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS + 500);
    });
    expect(texts(tree)).toEqual([]);
  });

  it("「元に戻す」付きは長く出て、押すと処理が動いて、閉じる", async () => {
    const tree = await mount();
    const undo = jest.fn();
    await show({ message: "「concern」を削除しました", action: { label: "元に戻す", onPress: undo } });
    await act(async () => {
      jest.advanceTimersByTime(TOAST_MS + 500);
    });
    expect(texts(tree)).toContain("元に戻す"); // 普通のトーストより長く出ている
    await act(async () => {
      tree.root.findByType(TouchableOpacity).props.onPress();
    });
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(texts(tree)).toEqual([]);
    expect(TOAST_WITH_ACTION_MS).toBeGreaterThan(TOAST_MS);
  });

  it("続けて出すと、あとの文章に入れ替わる", async () => {
    const tree = await mount();
    await show({ message: "1つ目" });
    await show({ message: "2つ目" });
    expect(texts(tree)).toEqual(["2つ目"]);
  });
});
