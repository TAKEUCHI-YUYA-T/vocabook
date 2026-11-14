import * as React from "react";
import { Text, TextInput } from "react-native";
import renderer, { act } from "react-test-renderer";
import { CardForm, emptyCardForm, type CardFormValue } from "../CardForm";

jest.mock("../Icon", () => ({ Icon: () => null }));
jest.mock("../SpeakButton", () => ({ SpeakButton: () => null }));

const verbWithAnswer: CardFormValue = { ...emptyCardForm("verb"), term: "enjoy", meaning: "楽しむ", answer: "ing" };

const texts = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(Text).map((node) => String(node.props.children));

describe("単語の入力フォームの、ing or to の答え", () => {
  it("動詞でも、ing or to の問題の欄は出さない（自動で判定できないため）", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<CardForm value={verbWithAnswer} onChange={() => {}} editable expanded />);
    });
    expect(texts(tree).some((text) => text.includes("ing or to"))).toBe(false);
  });

  it("ほかの欄を直しても、すでに付いている答えは消さない（以前の版や CSV の取り込みで付いた答え）", async () => {
    const onChange = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<CardForm value={verbWithAnswer} onChange={onChange} editable expanded />);
    });
    const meaning = tree.root.findAllByType(TextInput).find((input) => input.props.placeholder === "例: 廃止する")!;
    await act(async () => {
      meaning.props.onChangeText("楽しむ、享受する");
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meaning: "楽しむ、享受する", answer: "ing" }));
  });
});
