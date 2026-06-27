/**
 * T2.2 · 计量：单次运行的算力边际成本
 * 这是第 13 条的"费用·算力部分"（用户经 BYOK 在平台外承担；平台只计量供定价/排名）。
 * 以"提供商无关的标准化当量"计价（第 18 条）：单位无所谓，跨员工可比即可。
 * mock LLM 下 token 为占位计数。
 */
const PRICE_PER_KILO_INPUT = 0.003;
const PRICE_PER_KILO_OUTPUT = 0.015;

export function meterCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * PRICE_PER_KILO_INPUT +
    (outputTokens / 1000) * PRICE_PER_KILO_OUTPUT
  );
}
