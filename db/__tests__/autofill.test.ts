import { planAutoWrite } from "../autofill";

describe("自動入力の判定（planAutoWrite）", () => {
  it("欄が空なら、候補を書き込む", () => {
    expect(planAutoWrite<string>("", null, "りんご", "")).toEqual({ write: true, value: "りんご" });
    expect(planAutoWrite<string | null>(null, null, "verb", null)).toEqual({ write: true, value: "verb" });
  });

  it("前回に自動で入れた値のままなら、新しい候補に入れ替える", () => {
    expect(planAutoWrite<string>("りんご", "りんご", "みかん", "")).toEqual({ write: true, value: "みかん" });
  });

  it("あなたが入力・選択した値（空でも、前回の自動の値でもない）は、上書きしない", () => {
    expect(planAutoWrite<string>("自分の訳", "りんご", "みかん", "")).toEqual({ write: false });
    expect(planAutoWrite<string | null>("noun", null, "verb", null)).toEqual({ write: false });
  });

  it("候補がないときは、前回に自動で入れた値だけを消し、あなたの入力は消さない", () => {
    expect(planAutoWrite<string>("りんご", "りんご", null, "")).toEqual({ write: true, value: "" });
    expect(planAutoWrite<string>("自分の訳", "りんご", null, "")).toEqual({ write: false });
    expect(planAutoWrite<string>("", null, null, "")).toEqual({ write: false });
  });

  it("候補が、いまの値と同じなら、何もしない", () => {
    expect(planAutoWrite<string>("りんご", "りんご", "りんご", "")).toEqual({ write: false });
    expect(planAutoWrite<string | null>("verb", null, "verb", null)).toEqual({ write: false });
  });
});
