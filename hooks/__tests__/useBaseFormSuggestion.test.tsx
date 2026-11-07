import * as React from "react";
import renderer, { act } from "react-test-renderer";
import type { BaseFormSuggestion } from "@/db/lemma";
import { BASE_FORM_DELAY_MS, useBaseFormSuggestion } from "../useBaseFormSuggestion";

let suggestions: BaseFormSuggestion[] = [];
const went: BaseFormSuggestion = { word: "went", lemma: "go", kind: "過去形", isHeadword: false };
const suggest = jest.fn((term: string) => (term === "went" ? [went] : []));

function Harness({ term }: { term: string }) {
  suggestions = useBaseFormSuggestion(term, BASE_FORM_DELAY_MS, suggest);
  return null;
}

const mount = async (term: string) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Harness term={term} />);
  });
  return tree;
};
const update = async (tree: renderer.ReactTestRenderer, term: string) => {
  await act(async () => {
    tree.update(<Harness term={term} />);
  });
};
const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  suggest.mockClear();
});
afterEach(() => jest.useRealTimers());

describe("原形の候補（入力）", () => {
  it("入力が止まってから、候補を出す。入力の途中では出さない", async () => {
    const tree = await mount("wen");
    await update(tree, "went");
    await wait(BASE_FORM_DELAY_MS - 100);
    expect(suggestions).toEqual([]);
    await wait(200);
    expect(suggestions).toEqual([went]);
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it("単語を変えたら、前の候補はすぐ消える（原形に直した直後に、古い候補が残らない）", async () => {
    const tree = await mount("went");
    await wait(BASE_FORM_DELAY_MS + 10);
    expect(suggestions).toEqual([went]);
    await update(tree, "go");
    expect(suggestions).toEqual([]);
    await wait(BASE_FORM_DELAY_MS + 10);
    expect(suggestions).toEqual([]);
  });
});
