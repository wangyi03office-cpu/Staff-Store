/**
 * 定价（第 18 条）：加成 = 岗位基准费 × 质量系数；按服务次数收取，平台内以 CC 结算。
 * 用户总支出 = 算力(BYOK，平台外) + 加成(CC，平台内)。
 * 排名性价比 = 质量 ÷ 用户总支出（第 14 条）。
 */
export function markupFor(baseFee: number, quality0to100: number): number {
  const q = Math.max(0, Math.min(100, quality0to100));
  return baseFee * (q / 100); // 质量系数 = 质量/100
}

export function totalSpend(computeCost: number, markup: number): number {
  return computeCost + markup;
}

export function valueScore(quality0to100: number, total: number): number {
  return total > 0 ? quality0to100 / total : 0;
}
