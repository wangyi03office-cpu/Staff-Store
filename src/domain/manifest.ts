/**
 * T0.2 · 员工 Manifest 类型 + 校验
 * 落实宪法第六章（十组字段）、第 21 条（生命周期状态）、第 2 条（kind）。
 * 这是全系统的脊椎：Steve 产出、Elon 填充、店面读取、评测/计量消费。
 */
import { z } from "zod";

// 生命周期状态机（第 21 条）
export const EmployeeStatus = z.enum([
  "candidate",
  "packaging",
  "rejected",
  "probation",
  "active",
  "suspended",
  "fired",
  "deprecated",
]);
export type EmployeeStatus = z.infer<typeof EmployeeStatus>;

// 执行形态（④ / 第 2 条）
export const EmployeeKind = z.enum(["agent", "skill", "external-api"]);
export type EmployeeKind = z.infer<typeof EmployeeKind>;

// 安全分级（⑩）
export const SafetyClass = z.enum([
  "low",
  "needs-auth-high-privilege",
  "internal-high-privilege",
]);

// 交付渠道（⑥）
export const DeliveryChannel = z.enum(["web", "wechat", "email", "file", "api"]);

// 灵活键值袋（spec/config 等随场景不同）
const Bag = z.record(z.string(), z.unknown());

// ③ 来源溯源
export const Provenance = z.object({
  source: z.string(), // anthropics-skills | skillsmp | github | mcp | internal | ...
  source_ref: z.string(), // 去重主键之一（配合 upstream_version，第 16 条）
  upstream_version: z.string().default("0"), // 源 skill 的上游版本（Steve 去重用）
  original_author: z.string(), // 分成对象（作者账户 id）
  license: z.string().nullable().default(null), // SPDX 许可证类型
  attribution: z.string().nullable().default(null), // 对外展示的署名文本（第 9 条之一）
  discovered_by: z.string().nullable().default(null),
  packaged_by: z.string().nullable().default(null),
});

// ④ 执行
export const Execution = z.object({
  kind: EmployeeKind,
  spec: Bag.default({}), // agent: {system_prompt, tools, model}; skill: {skill_md}; external-api: {endpoint,...}
  inputs: Bag.default({}),
  outputs: Bag.default({}),
  schedule: z.string().nullable().default(null), // cron 或 null（按需）
  interaction_mode: z.enum(["autonomous", "needs_user_input"]).default("autonomous"),
  byok: z.string().nullable().default(null), // 雇主须自备的提供商/模型 key 说明
});

// ⑤ 授权需求
export const AuthorizationReq = z.object({
  provider: z.string(),
  scopes: z.array(z.string()).default([]),
  why: z.string().default(""),
});

// ⑥ 交付
export const Delivery = z.object({
  channels: z.array(DeliveryChannel).default(["web"]),
  config: Bag.default({}),
});

// ⑦ 经济（计价以 CC；加成 = 岗位基准费 × 质量系数，第 18 条）
export const RevenueShare = z
  .object({
    author: z.number().min(0).max(1),
    packager: z.number().min(0).max(1),
    platform: z.number().min(0).max(1),
  })
  .refine((r) => Math.abs(r.author + r.packager + r.platform - 1) < 1e-9, {
    message: "revenue_share 之和必须为 1",
  });
export type RevenueShare = z.infer<typeof RevenueShare>;

export const Economics = z.object({
  base_fee: z.number().nonnegative().nullable().default(null), // 岗位基准费（值由 CFO/第 32 条，Elon 只搭结构）
  cost_ceiling: z.number().nonnegative().nullable().default(null), // 体检成本上限（第 7 条）
  revenue_share: RevenueShare,
});

// ⑧ 评测指标
export const Metrics = z.object({
  quality: z.number().min(0).max(100).nullable().default(null),
  avg_cost: z.number().nonnegative().nullable().default(null),
  value: z.number().nullable().default(null), // 性价比 = 质量 / 总支出
  success_rate: z.number().min(0).max(1).nullable().default(null),
  user_rating: z.number().nullable().default(null),
  hire_count: z.number().int().nonnegative().default(0),
  samples: z.number().int().nonnegative().default(0),
});

export const Evaluation = z.object({
  eval_suite_ref: z.string().nullable().default(null),
  rubric_ref: z.string().nullable().default(null), // 含版本号（第 41 条）
  metrics: Metrics.prefault({}),
  rank_in_role: z.number().int().nullable().default(null),
});

// ⑨ 生命周期
export const HistoryEntry = z.object({
  at: z.string(), // ISO 时间
  from: EmployeeStatus.nullable(),
  to: EmployeeStatus,
  note: z.string().default(""),
});

export const Lifecycle = z.object({
  status: EmployeeStatus,
  gate_results: Bag.default({}),
  rework_count: z.number().int().nonnegative().default(0), // 执行第 7 条"退回至多一次"
  probation: Bag.default({}),
  history: z.array(HistoryEntry).default([]),
});

// ⑩ 安全
export const Safety = z.object({
  class: SafetyClass.default("low"),
  probe_results: Bag.default({}),
});

// 完整 Manifest（十组字段）
export const Manifest = z.object({
  // ① 身份
  id: z.string(),
  version: z.number().int().positive().default(1), // 随重新打包/上游更新递增
  name: z.string(),
  role: z.string(), // 岗位（排名按此分组，第 14/44 条）
  tagline: z.string().default(""),
  description: z.string().default(""),
  // ② 分类
  department: z.string().default(""),
  tags: z.array(z.string()).default([]),
  // ③–⑩
  provenance: Provenance,
  execution: Execution,
  requires_authorization: z.array(AuthorizationReq).default([]),
  delivery: Delivery.prefault({}),
  economics: Economics,
  evaluation: Evaluation.prefault({}),
  lifecycle: Lifecycle,
  safety: Safety.prefault({}),
});
export type Manifest = z.infer<typeof Manifest>;

/** 校验并补全默认值；失败抛错。 */
export function parseManifest(input: unknown): Manifest {
  return Manifest.parse(input);
}

/** 安全校验，返回 success/error，不抛。 */
export function safeParseManifest(input: unknown) {
  return Manifest.safeParse(input);
}
