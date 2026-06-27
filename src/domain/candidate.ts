/**
 * T0.3 · 候选档案（Candidate Dossier）类型
 * 落实 Steve 作业规程 §7：Steve 的交付物 = Elon 的输入。
 * 只填 Steve 能定的格，其余留给 Elon 打包成 manifest。
 */
import { z } from "zod";
import { EmployeeKind } from "./manifest.js";

// 闸门一逐条判定（Steve §5：四条硬门槛）
export const Gate1Item = z.enum([
  "complete_outcome", // ① 交付完整成果，不是零件
  "clear_contract", // ② 可重复、输入/输出契约清晰
  "safety_compliance", // ③ 安全合规（内容安全 + 许可证合规）
  "real_role", // ④ 对得上一个真实岗位
]);
export type Gate1Item = z.infer<typeof Gate1Item>;

export const Gate1Result = z.object({
  item: Gate1Item,
  pass: z.boolean(),
  evidence: z.string().default(""), // 证据（喂荐人命中率反馈）
});
export type Gate1Result = z.infer<typeof Gate1Result>;

// 软信号（Steve §6）
export const SoftSignals = z.object({
  demand: z.number().min(0).max(1).default(0), // 需求广度
  differentiation: z.number().min(0).max(1).default(0), // 差异化（对现有花名册查重）
  source_quality: z.number().min(0).max(1).default(0), // 源头质量（stars/维护者/更新近度/测试）
  quality_estimate: z.number().min(0).max(100).nullable().default(null), // 质量初估（LLM 预判）
  cost_estimate: z.number().nonnegative().nullable().default(null), // 成本初估（token 量级）
});

// 风险旗标
export const RiskFlags = z.object({
  safety: z.boolean().default(false),
  license: z.boolean().default(false),
  duplicate: z.boolean().default(false),
});

export const Recommendation = z.enum(["recommend", "hold", "reject"]);
export type Recommendation = z.infer<typeof Recommendation>;

export const CandidateDossier = z.object({
  id: z.string(), // 候选档案 id

  // 身份初拟
  proposed_name: z.string(),
  proposed_role: z.string(),
  tagline: z.string().default(""),
  description: z.string().default(""),

  // 来源溯源
  source: z.string(),
  source_ref: z.string(), // 去重主键之一
  upstream_version: z.string().default("0"), // 源 skill 上游版本
  original_author: z.string(),
  license: z.string().nullable().default(null),
  attribution: z.string().nullable().default(null),
  discovered_at: z.string(), // ISO 时间
  discovered_by: z.string(), // = Steve 的 id+version

  // 初判
  gate1_results: z.array(Gate1Result).default([]),
  kind_guess: EmployeeKind.nullable().default(null),

  // 软信号 + 优先级
  signals: SoftSignals.prefault({}),
  priority_score: z.number().min(0).max(1).default(0),

  // 初估（仅事实性；定价归 CFO/第 32 条）
  quality_estimate: z.number().min(0).max(100).nullable().default(null),
  cost_estimate: z.number().nonnegative().nullable().default(null),

  // 风险旗标 + 移交建议
  risks: RiskFlags.prefault({}),
  recommendation: Recommendation,
  reason: z.string().default(""),
});
export type CandidateDossier = z.infer<typeof CandidateDossier>;

export function parseCandidate(input: unknown): CandidateDossier {
  return CandidateDossier.parse(input);
}

/** 四条硬门槛是否全过（缺一否决，Steve §5）。 */
export function passesGate1(dossier: CandidateDossier): boolean {
  const required: Gate1Item[] = [
    "complete_outcome",
    "clear_contract",
    "safety_compliance",
    "real_role",
  ];
  return required.every((item) =>
    dossier.gate1_results.some((r) => r.item === item && r.pass),
  );
}
