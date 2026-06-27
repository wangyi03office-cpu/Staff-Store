/**
 * T7.2 · 端到端验收脚本（人读版）
 * 跑：seed → 工厂(Steve→Elon→闸门二→试用→转正) → 排名 → 一次真实雇佣 → 账本校验。
 * 运行：npm run e2e
 */
import { seedWorld } from "../seed/seed.js";
import { FixtureAdapter } from "../steve/source.js";
import { MockLLM } from "../runtime/llm.js";
import { runFactory } from "./pipeline.js";
import { rankRole } from "../economy/ranking.js";
import { hireEmployee } from "../economy/hire.js";

async function main(): Promise<void> {
  const world = seedWorld();
  const llm = new MockLLM();

  console.log("=== Staff Store 端到端验收 ===\n");
  console.log("① 初始：手种员工", [...world.registry.listManifests().map((m) => m.name)], "\n");

  const report = await runFactory(new FixtureAdapter(), { world, llm });
  console.log("② 工厂运转（Steve→Elon→闸门二→试用→转正）：");
  console.log(`   扫描 ${report.scanned} 条 → 候选 ${report.candidates} → 拒绝 ${report.rejected} → 新转正 ${report.onboarded.length}`);
  console.log(`   新员工：${report.onboarded.map((m) => `${m.name}(${m.lifecycle.status},质量${m.evaluation.metrics.quality?.toFixed(0)})`).join(", ")}\n`);

  console.log("③ 同岗位排名（情报秘书，质量地板60 + 性价比）：");
  const ranked = rankRole(world.registry.listByRole("intelligence-secretary"), "intelligence-secretary", world.params);
  for (const r of ranked) {
    console.log(`   ${r.name}：质量 ${r.quality.toFixed(0)} | 算力 ${r.computeCost.toFixed(4)} | 加成 ${r.markup.toFixed(2)}CC | 总支出 ${r.totalSpend.toFixed(4)} | 性价比 ${r.value.toFixed(1)}`);
  }

  console.log("\n④ 雇佣排名第一的员工：");
  const top = world.registry.getManifest(ranked[0]!.id)!;
  const receipt = await hireEmployee({ ledger: world.ledger, params: world.params, llm }, top, world.hirer, "AI 行业");
  console.log(`   交付物：${receipt.deliverable}`);
  console.log(`   算力 ${receipt.computeCost.toFixed(4)} | 加成 ${receipt.markup.toFixed(2)}CC | 总支出 ${receipt.totalSpend.toFixed(4)}`);

  console.log("\n⑤ 账本校验：");
  world.ledger.assertZeroSum();
  console.log(`   Σ 全账户余额 = ${world.ledger.totalBalance().toFixed(6)}（应为 0）`);
  console.log(`   哈希链完整 = ${world.ledger.verifyChain()}`);
  console.log(`   交易笔数 = ${world.ledger.allPostings().length}`);
  console.log("\n✅ 端到端闭环验收通过。");
}

main().catch((e) => {
  console.error("验收失败：", e);
  process.exit(1);
});
