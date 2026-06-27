import { describe, it, expect } from "vitest";
import { seedWorld } from "../seed/seed.js";
import { FixtureAdapter } from "../steve/source.js";
import { MockLLM } from "../runtime/llm.js";
import { runFactory } from "./pipeline.js";
import { rankRole } from "../economy/ranking.js";

describe("M7 · 全自动闭环端到端验收", () => {
  it("Steve→Elon→闸门二→上架→试用→转正→同岗排名，全程 Σ=0、链完好", async () => {
    const world = seedWorld(); // 已含手种的情报秘书(active)
    const llm = new MockLLM();

    const report = await runFactory(new FixtureAdapter(), { world, llm });

    // 工厂扫到 6 条、产出 1 个候选、最终转正 1 个新员工
    expect(report.scanned).toBe(6);
    expect(report.candidates).toBe(1);
    expect(report.onboarded.length).toBe(1);
    expect(report.onboarded[0]!.lifecycle.status).toBe("active");
    expect(report.onboarded[0]!.role).toBe("intelligence-secretary");

    // 同岗位现在有 2 个 active 员工（手种 + 工厂造）→ 排名
    const ranked = rankRole(
      world.registry.listByRole("intelligence-secretary"),
      "intelligence-secretary",
      world.params,
    );
    expect(ranked.length).toBe(2);
    // 排名按性价比降序：每个都带透明的 质量/算力/加成/总支出
    expect(ranked[0]!.value).toBeGreaterThanOrEqual(ranked[1]!.value);
    for (const r of ranked) {
      expect(r.quality).toBeGreaterThanOrEqual(60); // 过质量地板
      expect(r.totalSpend).toBeGreaterThan(0);
    }

    // 账本不变量
    world.ledger.assertZeroSum();
    expect(world.ledger.verifyChain()).toBe(true);
  });
});
