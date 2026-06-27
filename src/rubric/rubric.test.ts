import { describe, it, expect } from "vitest";
import { makeRubric, scoreRubric } from "./rubric.js";
import { MockJudge, MultiJudge, median, calibrate, type Judge } from "./judge.js";

describe("Rubric 评分（框架 §2/§4/§5）", () => {
  it("makeRubric：通用5 + 专属≤3，权重和=1", () => {
    const r = makeRubric("intelligence-secretary", ["信息覆盖度", "时效", "洞察力"]);
    expect(r.dimensions.length).toBe(8);
    const sum = r.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it("专属维度 > 3 → 抛错", () => {
    expect(() => makeRubric("x", ["a", "b", "c", "d"])).toThrow(/≤ 3/);
  });

  it("评分函数：满分维度 → 100", () => {
    const r = makeRubric("x", []);
    const dims: Record<string, number> = {};
    for (const d of r.dimensions) dims[d.name] = 100;
    expect(scoreRubric(r, dims)).toBeCloseTo(100, 6);
  });

  it("中位数聚合", () => {
    expect(median([10, 90, 50])).toBe(50);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("多裁判：取中位数，标注版本", async () => {
    const r = makeRubric("x", []);
    const fixed = (v: number): Judge =>
      new MockJudge(`j${v}`, (rb) => Object.fromEntries(rb.dimensions.map((d) => [d.name, v])));
    const mj = new MultiJudge([fixed(40), fixed(80), fixed(60)]);
    const s = await mj.score(r, "in", "out");
    expect(s.quality).toBeCloseTo(60, 6); // 中位
    expect(s.rubric_version).toBe("v1");
    expect(s.judge_model).toContain("multi");
  });

  it("黄金集校准：MAE 与漂移标记", async () => {
    const r = makeRubric("x", []);
    // 一个总打 100 的裁判，对黄金分 70 的样本 → MAE=30 → 漂移
    const judge = new MockJudge("hi", (rb) => Object.fromEntries(rb.dimensions.map((d) => [d.name, 100])));
    const { mae, drift } = await calibrate(judge, r, [{ input: "i", output: "o", goldScore: 70 }]);
    expect(mae).toBeCloseTo(30, 6);
    expect(drift).toBe(true);
  });
});
