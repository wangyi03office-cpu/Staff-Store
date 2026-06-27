/**
 * T0.4 · 内存注册表
 * 存 manifests 与 candidates；落实第 16 条去重与更新：
 *   - 以 source_ref 为唯一键，一个源 skill 只建一条档案；
 *   - 上游出现实质性新版本（upstream_version 变化）→ 触发重评/更新，而非永久屏蔽。
 * MVP 用内存 Map；跑通后换 SQLite（见任务清单全局决定）。
 */
import type { Manifest } from "../domain/manifest.js";
import type { CandidateDossier } from "../domain/candidate.js";

export type AddOutcome = "added" | "duplicate" | "updated";

export interface AddResult<T> {
  outcome: AddOutcome;
  record: T;
}

export class Registry {
  private manifests = new Map<string, Manifest>();
  private candidates = new Map<string, CandidateDossier>();

  // ---------- 候选档案 ----------

  /**
   * 加入候选档案，按 (source_ref, upstream_version) 去重。
   * 已存在同源同版 → duplicate（不重复建档）；同源新版 → updated（触发重评）。
   */
  addCandidate(d: CandidateDossier): AddResult<CandidateDossier> {
    const existing = this.findCandidateBySource(d.source_ref);
    if (existing) {
      if (existing.upstream_version === d.upstream_version) {
        return { outcome: "duplicate", record: existing };
      }
      // 上游新版本：更新该档案（沿用原 id，第 16 条）
      const updated = { ...d, id: existing.id };
      this.candidates.set(existing.id, updated);
      return { outcome: "updated", record: updated };
    }
    this.candidates.set(d.id, d);
    return { outcome: "added", record: d };
  }

  getCandidate(id: string): CandidateDossier | undefined {
    return this.candidates.get(id);
  }

  findCandidateBySource(source_ref: string): CandidateDossier | undefined {
    for (const c of this.candidates.values()) {
      if (c.source_ref === source_ref) return c;
    }
    return undefined;
  }

  listCandidates(filter?: (c: CandidateDossier) => boolean): CandidateDossier[] {
    const all = [...this.candidates.values()];
    return filter ? all.filter(filter) : all;
  }

  // ---------- Manifest（已上线/打包中的员工） ----------

  /**
   * 写入/更新 manifest，按 source_ref 去重。
   * 同源同版 → duplicate；同源新版 → updated（沿用原 id，bump version）；否则 added。
   */
  upsertManifest(m: Manifest): AddResult<Manifest> {
    const existing = this.findManifestBySource(m.provenance.source_ref);
    if (existing && existing.id !== m.id) {
      if (existing.provenance.upstream_version === m.provenance.upstream_version) {
        return { outcome: "duplicate", record: existing };
      }
      const updated: Manifest = {
        ...m,
        id: existing.id,
        version: existing.version + 1,
      };
      this.manifests.set(existing.id, updated);
      return { outcome: "updated", record: updated };
    }
    const outcome: AddOutcome = this.manifests.has(m.id) ? "updated" : "added";
    this.manifests.set(m.id, m);
    return { outcome, record: m };
  }

  getManifest(id: string): Manifest | undefined {
    return this.manifests.get(id);
  }

  findManifestBySource(source_ref: string): Manifest | undefined {
    for (const m of this.manifests.values()) {
      if (m.provenance.source_ref === source_ref) return m;
    }
    return undefined;
  }

  listManifests(filter?: (m: Manifest) => boolean): Manifest[] {
    const all = [...this.manifests.values()];
    return filter ? all.filter(filter) : all;
  }

  /** 按岗位取（用于"同一岗位内排名"，第 14 条）。 */
  listByRole(role: string): Manifest[] {
    return this.listManifests((m) => m.role === role);
  }

  removeManifest(id: string): boolean {
    return this.manifests.delete(id);
  }

  // ---------- 统计 ----------

  counts(): { manifests: number; candidates: number } {
    return { manifests: this.manifests.size, candidates: this.candidates.size };
  }
}
