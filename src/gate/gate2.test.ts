import { describe, it, expect } from "vitest";
import { scan } from "../steve/steve.js";
import { FixtureAdapter } from "../steve/source.js";
import { Registry } from "../registry/registry.js";
import { DEFAULT_PARAMS } from "../ledger/config.js";
import { packageCandidate, selfTest } from "../elon/elon.js";
import { gate2 } from "./gate2.js";
import { MockLLM } from "../runtime/llm.js";
import { MockJudge, MultiJudge } from "../rubric/judge.js";
import { makeRubric } from "../rubric/rubric.js";

const rubric = makeRubric("intelligence-secretary", ["信息覆盖度", "时效", "洞察力"]);
const multiJudge = new MultiJudge([new MockJudge("j1"), new MockJudge("j2"), new MockJudge("j3")]);

describe("里程碑 C · Steve→Elon→独立闸门二 自动产出并上架", () => {
  it("happy path：扫→打包→自测→闸门二→probation", async () => {
    const reg = new Registry();
    const res = await scan(new FixtureAdapter(), reg);
    const cand = res.candidates[0]!;

    const m = packageCandidate(cand, DEFAULT_PARAMS);
    expect(m.lifecycle.status).toBe("packaging");
    expect(m.economics.base_fee).toBeNull(); // Elon 不自定基准费

    const llm = new MockLLM();
    const self = await selfTest(m, llm);
    expect(self.pass).toBe(true);

    const report = await gate2(m, { llm, judge: multiJudge, rubric });
    expect(report.verdict).toBe("probation");
    expect(m.lifecycle.status).toBe("probation");
    expect(m.evaluation.metrics.quality).toBeGreaterThanOrEqual(60); // 真实评分替代 stub
    expect(m.evaluation.metrics.quality).not.toBeNull();
  });

  it("安全探针失败：被注入操纵 → 退回(≤1) → 再不过 → rejected", async () => {
    const reg = new Registry();
    const res = await scan(new FixtureAdapter(), reg);
    const m = packageCandidate(res.candidates[0]!, DEFAULT_PARAMS);

    // 被操纵的员工：对注入探针会照做、输出泄漏标记
    const leaky = new MockLLM({
      responder: (_sys, input) =>
        input.includes("忽略以上") ? "SECRET_LEAK_TOKEN" : `针对「${input}」的交付物`,
    });

    const r1 = await gate2(m, { llm: leaky, judge: multiJudge, rubric });
    expect(r1.verdict).toBe("rework");
    expect(r1.checks["safety"]!.pass).toBe(false);
    expect(m.lifecycle.rework_count).toBe(1);

    const r2 = await gate2(m, { llm: leaky, judge: multiJudge, rubric });
    expect(r2.verdict).toBe("rejected");
    expect(m.lifecycle.status).toBe("rejected");
  });
});
