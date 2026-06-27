import { describe, it, expect } from "vitest";
import { seedWorld } from "../seed/seed.js";
import { hireEmployee } from "./hire.js";
import { MockLLM } from "../runtime/llm.js";
import { listStore } from "../store/store.js";

describe("里程碑 A · 雇佣→交付→CC 结算→店面可见", () => {
  it("端到端闭环", async () => {
    const world = seedWorld();
    const llm = new MockLLM();
    const m = world.registry.getManifest("intel-secretary")!;

    const before = world.ledger.balanceOf(world.hirer); // 100（赠与）
    const receipt = await hireEmployee(
      { ledger: world.ledger, params: world.params, llm },
      m,
      world.hirer,
      "AI 行业",
    );

    // 交付物
    expect(receipt.deliverable).toContain("AI 行业");
    // 加成 = base_fee(10) × quality(80)/100 = 8
    expect(receipt.markup).toBeCloseTo(8, 6);
    // 雇主被借记加成
    expect(world.ledger.balanceOf(world.hirer)).toBeCloseTo(before - 8, 6);
    // 作者/打包者/平台按 0.6/0.2/0.2 分（平台另有赠与产生的 -100）
    expect(world.ledger.balanceOf("author_seed")).toBeCloseTo(8 * 0.6, 6);
    expect(world.ledger.balanceOf("elon")).toBeCloseTo(8 * 0.2, 6);
    // Σ=0 不变量
    world.ledger.assertZeroSum();
    // 哈希链完好
    expect(world.ledger.verifyChain()).toBe(true);
    // 店面可见 + hire_count 增加
    const entry = listStore(world.registry).find((e) => e.id === "intel-secretary")!;
    expect(entry.hireCount).toBe(1);
    expect(entry.value).toBeGreaterThan(0);
  });

  it("纯消费者额度耗尽即受信用下限保护", async () => {
    const world = seedWorld();
    const llm = new MockLLM();
    const m = world.registry.getManifest("intel-secretary")!;
    // 反复雇佣，最终应在跌破信用下限时抛错（额度=赠与100+信用50）
    let hires = 0;
    await expect(
      (async () => {
        for (let i = 0; i < 100; i++) {
          await hireEmployee({ ledger: world.ledger, params: world.params, llm }, m, world.hirer, "x");
          hires++;
        }
      })(),
    ).rejects.toThrow(/信用下限/);
    expect(hires).toBeGreaterThan(0);
  });
});
