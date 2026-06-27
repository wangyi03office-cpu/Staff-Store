/**
 * T3.1–T3.2 · Rubric 结构 + 评分函数
 * 落实岗位 Rubric 框架 §2：通用维度(5) + 岗位专属维度(≤3)；每维度 = 权重 + 锚点；
 * 评分函数：维度按锚点给 0–100 → Σ(权重×维度分) → 质量分 0–100。
 */
import { z } from "zod";

export const GENERAL_DIMENSIONS = ["准确性", "完整性", "可用性", "契合度", "安全合规"] as const;

export const Anchors = z.object({
  low: z.string().default(""),
  mid: z.string().default(""),
  high: z.string().default(""),
});

export const Dimension = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  kind: z.enum(["general", "role-specific"]).default("general"),
  anchors: Anchors.prefault({}),
});
export type Dimension = z.infer<typeof Dimension>;

export const Rubric = z
  .object({
    role: z.string(),
    rubric_version: z.string(), // 第 41 条：评分须可标注版本
    dimensions: z.array(Dimension).min(1),
  })
  .refine(
    (r) => Math.abs(r.dimensions.reduce((s, d) => s + d.weight, 0) - 1) < 1e-6,
    { message: "维度权重之和必须为 1" },
  );
export type Rubric = z.infer<typeof Rubric>;

/**
 * 便捷构造：通用 5 维 + 岗位专属(≤3)，等权归一。
 */
export function makeRubric(
  role: string,
  roleSpecific: string[],
  version = "v1",
): Rubric {
  if (roleSpecific.length > 3) throw new Error("岗位专属维度 ≤ 3（框架 §2）");
  const names = [
    ...GENERAL_DIMENSIONS.map((n) => ({ n, kind: "general" as const })),
    ...roleSpecific.map((n) => ({ n, kind: "role-specific" as const })),
  ];
  const w = 1 / names.length;
  return Rubric.parse({
    role,
    rubric_version: version,
    dimensions: names.map(({ n, kind }) => ({ name: n, weight: w, kind })),
  });
}

/** 评分函数：dimScores 为各维度 0–100 → 加权 → 质量分 0–100。 */
export function scoreRubric(rubric: Rubric, dimScores: Record<string, number>): number {
  let s = 0;
  for (const d of rubric.dimensions) {
    const v = clamp(dimScores[d.name] ?? 0, 0, 100);
    s += d.weight * v;
  }
  return s;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
