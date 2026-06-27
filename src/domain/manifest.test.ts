import { describe, it, expect } from "vitest";
import { safeParseManifest } from "./manifest.js";
import { makeManifest } from "../test/fixtures.js";

describe("Manifest 校验（第六章）", () => {
  it("合法 manifest 解析并补全默认值", () => {
    const m = makeManifest();
    expect(m.version).toBe(1); // 默认
    expect(m.delivery.channels).toEqual(["web"]); // 默认
    expect(m.lifecycle.rework_count).toBe(0); // 默认
    expect(m.evaluation.metrics.hire_count).toBe(0); // 默认
    expect(m.safety.class).toBe("low"); // 默认
  });

  it("revenue_share 之和不为 1 → 拒绝", () => {
    const r = safeParseManifest({
      id: "x",
      name: "x",
      role: "r",
      provenance: { source: "internal", source_ref: "s", original_author: "p" },
      execution: { kind: "agent" },
      economics: { revenue_share: { author: 0.5, packager: 0.3, platform: 0.5 } },
      lifecycle: { status: "active" },
    });
    expect(r.success).toBe(false);
  });

  it("非法生命周期状态 → 拒绝", () => {
    const r = safeParseManifest(
      makeManifestRaw({ lifecycle: { status: "on-vacation" } }),
    );
    expect(r.success).toBe(false);
  });

  it("非法 kind → 拒绝", () => {
    const r = safeParseManifest(makeManifestRaw({ execution: { kind: "wizard" } }));
    expect(r.success).toBe(false);
  });
});

// 不经 parse 的原始对象（用于测试非法输入）
function makeManifestRaw(overrides: Record<string, unknown>): unknown {
  return {
    id: "x",
    name: "x",
    role: "r",
    provenance: { source: "internal", source_ref: "s", original_author: "p" },
    execution: { kind: "agent" },
    economics: { revenue_share: { author: 0.5, packager: 0.3, platform: 0.2 } },
    lifecycle: { status: "active" },
    ...overrides,
  };
}
