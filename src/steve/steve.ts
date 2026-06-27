/**
 * T4.2 · Steve 的漏斗（廉价 → 昂贵）
 * 拉取/解析 → 去重 → 廉价预筛(垃圾+SPDX) → 闸门一(初筛) → 软信号 → 候选档案。
 * 闸门一用可注入的 screener（离线 = 启发式；接真 key = LLM）。
 */
import type { SourceAdapter, RawSkill } from "./source.js";
import { licenseAllowed } from "./license.js";
import type { Registry } from "../registry/registry.js";
import {
  parseCandidate,
  type CandidateDossier,
  type Gate1Result,
} from "../domain/candidate.js";

export interface ScanResult {
  scanned: number;
  candidates: CandidateDossier[];
  rejected: { source_ref: string; reason: string }[];
  duplicates: number;
}

export interface Gate1Screener {
  screen(raw: RawSkill): Gate1Result[];
}

const STEVE_ID = "steve@v0.4";

export async function scan(
  adapter: SourceAdapter,
  registry: Registry,
  screener: Gate1Screener = new HeuristicScreener(),
): Promise<ScanResult> {
  const raws = await adapter.fetch();
  const res: ScanResult = { scanned: raws.length, candidates: [], rejected: [], duplicates: 0 };

  for (const raw of raws) {
    // ② 去重（第 16 条）：同源同版的候选或已上线员工 → 跳过
    const dupCand = registry.findCandidateBySource(raw.source_ref);
    const dupMani = registry.findManifestBySource(raw.source_ref);
    if (
      (dupCand && dupCand.upstream_version === raw.upstream_version) ||
      (dupMani && dupMani.provenance.upstream_version === raw.upstream_version)
    ) {
      res.duplicates++;
      continue;
    }

    // ③ 廉价预筛：客观垃圾 + SPDX 黑名单（绝不按流行度淘汰，Steve §4）
    if (raw.archived || !raw.hasSkillMd || raw.description.trim().length === 0) {
      res.rejected.push({ source_ref: raw.source_ref, reason: "客观垃圾(归档/无SKILL.md/空描述)" });
      continue;
    }
    if (!licenseAllowed(raw.license)) {
      res.rejected.push({ source_ref: raw.source_ref, reason: `许可证不合规: ${raw.license}` });
      continue;
    }

    // ④ 闸门一初筛（昂贵，仅对过廉价筛者）
    const gate1 = screener.screen(raw);

    // ⑤ 软信号 + 优先级
    const signals = softSignals(raw);
    const priority = priorityScore(signals);
    const allGatesPass = gate1.every((x) => x.pass);

    const dossier = parseCandidate({
      id: `cand:${raw.source_ref}`,
      proposed_name: raw.name,
      proposed_role: raw.roleHint ?? slug(raw.name),
      tagline: raw.description.slice(0, 40),
      description: raw.description,
      source: raw.source,
      source_ref: raw.source_ref,
      upstream_version: raw.upstream_version,
      original_author: raw.author,
      license: raw.license,
      attribution: `© ${raw.author}，据其 ${raw.license} 许可`,
      discovered_at: new Date().toISOString(),
      discovered_by: STEVE_ID,
      gate1_results: gate1,
      kind_guess: "agent",
      signals,
      priority_score: priority,
      quality_estimate: signals.quality_estimate,
      cost_estimate: signals.cost_estimate,
      risks: {
        safety: gate1.some((g) => g.item === "safety_compliance" && !g.pass),
        license: false, // 已在 ③ 拦截
        duplicate: false,
      },
      recommendation: allGatesPass ? "recommend" : "reject",
      reason: gate1
        .filter((g) => !g.pass)
        .map((g) => `${g.item}:${g.evidence}`)
        .join("; ") || "四门槛全过",
    });

    if (dossier.recommendation === "recommend") {
      registry.addCandidate(dossier);
      res.candidates.push(dossier);
    } else {
      res.rejected.push({ source_ref: raw.source_ref, reason: `闸门一未过: ${dossier.reason}` });
    }
  }
  return res;
}

// ---- 启发式闸门一（离线确定性） ----

export class HeuristicScreener implements Gate1Screener {
  screen(raw: RawSkill): Gate1Result[] {
    const text = `${raw.name} ${raw.description}`.toLowerCase();
    const isPart = /\b(pad|util|utility|helper|library|format a |formatter|wrapper)\b/.test(text);
    const isDeliverable = /(汇总|生成|报告|早报|审查|翻译|分析|整理|brief|report|summary|review)/.test(
      `${raw.name} ${raw.description}`,
    );
    const banned = /(窃取|外传|恶意|盗取|steal|malware|exfiltrat)/i.test(`${raw.name} ${raw.description}`);

    const complete = isDeliverable && !isPart;
    const contract = raw.hasSkillMd && raw.description.trim().length >= 6;
    const safety = !banned && licenseAllowed(raw.license);
    const realRole = complete;

    return [
      g("complete_outcome", complete, complete ? "" : "像零件/无独立交付物"),
      g("clear_contract", contract, contract ? "" : "契约不清"),
      g("safety_compliance", safety, safety ? "" : banned ? "内容安全否决" : "许可证否决"),
      g("real_role", realRole, realRole ? "" : "对不上真实岗位"),
    ];
  }
}

function g(item: Gate1Result["item"], pass: boolean, evidence: string): Gate1Result {
  return { item, pass, evidence };
}

function softSignals(raw: RawSkill) {
  const source_quality = Math.min(1, raw.stars / 1000);
  const demand = source_quality; // 占位：用流行度近似需求广度
  const differentiation = 0.5; // 占位（真实需对花名册向量查重）
  const quality_estimate = Math.round(60 + source_quality * 30); // 60–90 占位
  const cost_estimate = 0.01; // 占位 token 量级
  return { demand, differentiation, source_quality, quality_estimate, cost_estimate };
}

function priorityScore(s: ReturnType<typeof softSignals>): number {
  return Math.min(1, 0.4 * s.demand + 0.3 * s.differentiation + 0.3 * s.source_quality);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "role";
}
