/**
 * 生命周期状态转移（第 21 条）。
 * M5 先提供基础 transition；M6（T6.2）补完整转移合法性校验。
 */
import type { Manifest, EmployeeStatus } from "../domain/manifest.js";

// 允许的转移（第 21 条状态机）
const ALLOWED: Record<EmployeeStatus, EmployeeStatus[]> = {
  candidate: ["packaging"],
  packaging: ["packaging", "probation", "rejected"],
  rejected: ["candidate"], // 上游实质更新可重入
  probation: ["active", "suspended", "fired"],
  active: ["suspended", "fired", "deprecated"],
  suspended: ["active", "fired"],
  fired: ["probation"], // 复活
  deprecated: ["probation"], // 复活
};

export function canTransition(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function transition(m: Manifest, to: EmployeeStatus, note = ""): void {
  const from = m.lifecycle.status;
  if (from !== to && !canTransition(from, to)) {
    throw new Error(`非法状态转移：${from} → ${to}（第 21 条）`);
  }
  m.lifecycle.history.push({ at: new Date().toISOString(), from, to, note });
  m.lifecycle.status = to;
}
