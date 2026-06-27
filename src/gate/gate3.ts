/**
 * T6.1–T6.2 · 闸门三（试用期 + 持续监控 + 自动开除 + 复活）
 * 第 8 条：试用按真实任务数达标→转正；跌破红线→暂停/开除；复活→重过闸门。
 */
import type { Manifest } from "../domain/manifest.js";
import { transition } from "../lifecycle/lifecycle.js";

export interface Gate3Params {
  probationTasks: number; // 试用期最少任务数（按真实任务数，非日历）
  qualityFloor: number; // 质量红线
  successFloor: number; // 成功率红线
}

export const DEFAULT_GATE3: Gate3Params = {
  probationTasks: 3,
  qualityFloor: 60,
  successFloor: 0.5,
};

/** T6.1 指标采集：记一次任务结局（成功率 / 用户评分 / 样本）。 */
export function recordOutcome(
  m: Manifest,
  outcome: { success: boolean; rating?: number },
): void {
  const me = m.evaluation.metrics;
  const n = me.samples;
  const s = outcome.success ? 1 : 0;
  me.success_rate = me.success_rate == null ? s : (me.success_rate * n + s) / (n + 1);
  if (outcome.rating != null) {
    me.user_rating = me.user_rating == null ? outcome.rating : (me.user_rating * n + outcome.rating) / (n + 1);
  }
  me.samples = n + 1;
}

export type Gate3Action = "promoted" | "fired" | "suspended" | "none";

/** T6.2 状态机：据指标决定转正 / 暂停 / 开除。 */
export function evaluateLifecycle(m: Manifest, p: Gate3Params = DEFAULT_GATE3): Gate3Action {
  const me = m.evaluation.metrics;
  const q = me.quality ?? 0;
  const sr = me.success_rate ?? 1;

  if (m.lifecycle.status === "probation") {
    if (me.hire_count >= p.probationTasks) {
      if (q >= p.qualityFloor && sr >= p.successFloor) {
        transition(m, "active", "试用达标，转正放量");
        return "promoted";
      }
      transition(m, "fired", "试用不达标");
      return "fired";
    }
    return "none";
  }

  if (m.lifecycle.status === "active") {
    if (q < p.qualityFloor || sr < p.successFloor) {
      // 暂停（可逆，缺位/复活逻辑友好）；严重则可进一步 fired
      transition(m, "suspended", "跌破红线，暂停");
      return "suspended";
    }
    return "none";
  }
  return "none";
}

/** 复活（第 8 条）：suspended→active（问题排除）；fired/deprecated→probation（重过闸门二）。 */
export function revive(m: Manifest, note = "复活"): void {
  const s = m.lifecycle.status;
  if (s === "suspended") transition(m, "active", note + "·问题排除复岗");
  else if (s === "fired" || s === "deprecated") transition(m, "probation", note + "·重过闸门二");
}
