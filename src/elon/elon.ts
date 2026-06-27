/**
 * T5.1–T5.2 · Elon 打包 + 提交前自测（廉价项）
 * 候选档案 → manifest（人设/提示词/execution/经济结构/署名/byok）。
 * Elon 不自定基准费：economics.base_fee 留空，结算时按货币参数取（第 18/32 条）。
 * 自测只跑廉价项（冒烟①/成本③/交付④）；昂贵项归独立闸门二（Elon 规程 §5）。
 */
import { parseManifest, type Manifest } from "../domain/manifest.js";
import type { CandidateDossier } from "../domain/candidate.js";
import type { MonetaryParams } from "../ledger/config.js";
import type { LLMClient } from "../runtime/llm.js";
import { runEmployee } from "../runtime/runner.js";

export function packageCandidate(c: CandidateDossier, params: MonetaryParams): Manifest {
  const role = c.proposed_role;
  return parseManifest({
    id: `emp:${c.source_ref}`,
    name: c.proposed_name,
    role,
    tagline: c.tagline,
    description: c.description,
    department: "对外服务",
    provenance: {
      source: c.source,
      source_ref: c.source_ref,
      upstream_version: c.upstream_version,
      original_author: c.original_author,
      license: c.license,
      attribution: c.attribution,
      discovered_by: c.discovered_by,
      packaged_by: "elon",
    },
    execution: {
      kind: c.kind_guess ?? "agent",
      spec: {
        system_prompt: `你是「${c.proposed_name}」。${c.description}。请据用户输入，产出该岗位的成品交付物。`,
        model: "claude-mock",
      },
      byok: "用户须自备 LLM 提供商 key（BYOK，第 27 条）",
    },
    delivery: { channels: ["web"] },
    economics: {
      // base_fee 留空——Elon 只搭结构，值由 CFO/货币参数（第 32 条）
      cost_ceiling: 1.0, // 体检成本上限（第 7 条）
      revenue_share: params.revenueShare,
    },
    evaluation: { rubric_ref: `${role}@v1` },
    lifecycle: { status: "packaging", rework_count: 0 },
    safety: { class: "low" },
  });
}

export interface SelfTestReport {
  pass: boolean;
  issues: string[];
}

/** 提交前自测（廉价项）：冒烟 + 成本 + 交付渠道。 */
export async function selfTest(
  m: Manifest,
  llm: LLMClient,
  sampleInput = "示例任务",
): Promise<SelfTestReport> {
  const issues: string[] = [];
  const run = await runEmployee(m, sampleInput, llm);
  if (run.deliverable.trim().length === 0) issues.push("冒烟失败：空输出");
  const ceiling = m.economics.cost_ceiling ?? Number.POSITIVE_INFINITY;
  if (run.computeCost > ceiling) issues.push(`成本超上限：${run.computeCost} > ${ceiling}`);
  if (m.delivery.channels.length === 0) issues.push("无交付渠道");
  return { pass: issues.length === 0, issues };
}
