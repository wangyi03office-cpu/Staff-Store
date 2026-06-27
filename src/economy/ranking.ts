/**
 * T6.3 · 排名服务（第 14 条）：同一岗位内，先设质量地板，过线者按性价比降序。
 * 性价比 = 质量 ÷ 用户总支出（算力 + 加成）。两数透明展示。
 */
import type { Manifest } from "../domain/manifest.js";
import { type MonetaryParams, baseFeeFor } from "../ledger/config.js";
import { markupFor, totalSpend, valueScore } from "./pricing.js";

export interface RankedEmployee {
  id: string;
  name: string;
  role: string;
  quality: number;
  computeCost: number; // 算力（透明展示）
  markup: number; // 加成（透明展示）
  totalSpend: number;
  value: number; // 性价比
}

const FALLBACK_COST = 0.001; // 尚无 avg_cost 时的占位算力

export function rankRole(
  manifests: Manifest[],
  role: string,
  params: MonetaryParams,
  qualityFloor = 60,
): RankedEmployee[] {
  return manifests
    .filter(
      (m) =>
        m.role === role &&
        m.lifecycle.status === "active" &&
        (m.evaluation.metrics.quality ?? 0) >= qualityFloor, // 质量地板
    )
    .map((m) => {
      const quality = m.evaluation.metrics.quality ?? 0;
      const computeCost = m.evaluation.metrics.avg_cost ?? FALLBACK_COST;
      const baseFee = m.economics.base_fee ?? baseFeeFor(params, role);
      const markup = markupFor(baseFee, quality);
      const total = totalSpend(computeCost, markup);
      return {
        id: m.id,
        name: m.name,
        role,
        quality,
        computeCost,
        markup,
        totalSpend: total,
        value: valueScore(quality, total),
      };
    })
    .sort((a, b) => b.value - a.value); // 性价比降序
}
