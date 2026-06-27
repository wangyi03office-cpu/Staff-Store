/**
 * T2.5 · 店面服务（列表 + 雇佣 + 看交付物）
 * M2 只做"列表展示"；真正的"质量地板 + 性价比"排名在 T6.3。
 * 这里按 value（性价比，若已有）做个朴素降序，便于观察。
 */
import type { Registry } from "../registry/registry.js";
import type { Manifest } from "../domain/manifest.js";

export interface StoreEntry {
  id: string;
  name: string;
  role: string;
  tagline: string;
  quality: number | null;
  value: number | null; // 性价比
  hireCount: number;
}

export function toEntry(m: Manifest): StoreEntry {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    tagline: m.tagline,
    quality: m.evaluation.metrics.quality,
    value: m.evaluation.metrics.value,
    hireCount: m.evaluation.metrics.hire_count,
  };
}

/** 上架（active）员工列表，按 value 朴素降序（无 value 排后）。 */
export function listStore(registry: Registry): StoreEntry[] {
  return registry
    .listManifests((m) => m.lifecycle.status === "active")
    .map(toEntry)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}
