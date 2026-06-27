/**
 * T7.1 · 全自动工厂闭环
 * Steve 扫描 → Elon 打包 → 独立闸门二 → 上架(probation) → 试用运营 → 转正(active)。
 * 之后即可在店面被雇佣、被闸门三监控、参与同岗排名。
 */
import type { SourceAdapter } from "../steve/source.js";
import type { SeededWorld } from "../seed/seed.js";
import type { LLMClient } from "../runtime/llm.js";
import type { Manifest } from "../domain/manifest.js";
import { scan } from "../steve/steve.js";
import { packageCandidate } from "../elon/elon.js";
import { gate2 } from "../gate/gate2.js";
import { recordOutcome, evaluateLifecycle, DEFAULT_GATE3 } from "../gate/gate3.js";
import { hireEmployee } from "../economy/hire.js";
import { makeRubric, type Rubric } from "../rubric/rubric.js";
import { MockJudge, MultiJudge, type Judge } from "../rubric/judge.js";

// 各岗位的专属维度（最小映射；未知岗位仅用通用 5 维）
const ROLE_SPECIFIC: Record<string, string[]> = {
  "intelligence-secretary": ["信息覆盖度", "时效", "洞察力"],
};

export function rubricFor(role: string): Rubric {
  return makeRubric(role, ROLE_SPECIFIC[role] ?? []);
}

export interface FactoryReport {
  scanned: number;
  candidates: number;
  rejected: number;
  onboarded: Manifest[]; // 新转正上岗的员工
}

export interface FactoryDeps {
  world: SeededWorld;
  llm: LLMClient;
  judge?: Judge; // 独立闸门二的多裁判；默认 3 名 mock
}

export async function runFactory(adapter: SourceAdapter, deps: FactoryDeps): Promise<FactoryReport> {
  const { world, llm } = deps;
  const judge =
    deps.judge ?? new MultiJudge([new MockJudge("j1"), new MockJudge("j2"), new MockJudge("j3")]);

  const scanRes = await scan(adapter, world.registry);
  const onboarded: Manifest[] = [];

  for (const cand of scanRes.candidates) {
    const m = packageCandidate(cand, world.params);

    // 结算需要作者账户存在
    if (!world.ledger.hasAccount(m.provenance.original_author)) {
      world.ledger.openAccount(m.provenance.original_author, "developer", world.params.defaultCreditLimit);
    }

    // 独立闸门二（含退回至多一次）
    const rubric = rubricFor(m.role);
    let report = await gate2(m, { llm, judge, rubric });
    if (report.verdict === "rework") {
      report = await gate2(m, { llm, judge, rubric });
    }
    if (m.lifecycle.status !== "probation") continue; // rejected

    world.registry.upsertManifest(m);

    // 试用运营：跑满试用任务数 → 转正
    for (let i = 0; i < DEFAULT_GATE3.probationTasks; i++) {
      await hireEmployee({ ledger: world.ledger, params: world.params, llm }, m, world.hirer, "试用任务");
      recordOutcome(m, { success: true, rating: 5 });
    }
    const action = evaluateLifecycle(m); // probation → active
    if (action === "promoted") onboarded.push(m);
  }

  return {
    scanned: scanRes.scanned,
    candidates: scanRes.candidates.length,
    rejected: scanRes.rejected.length,
    onboarded,
  };
}
