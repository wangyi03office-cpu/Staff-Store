import { describe, it, expect } from "vitest";
import { recordOutcome, evaluateLifecycle, revive } from "./gate3.js";
import { rankRole } from "../economy/ranking.js";
import { DEFAULT_PARAMS } from "../ledger/config.js";
import { makeManifest } from "../test/fixtures.js";

describe("闸门三：试用/转正/暂停/复活（第 8 条）", () => {
  it("试用达标 → 转正 active", () => {
    const m = makeManifest({ lifecycle: { status: "probation" } });
    m.evaluation.metrics.quality = 80;
    m.evaluation.metrics.hire_count = 3;
    recordOutcome(m, { success: true });
    recordOutcome(m, { success: true });
    recordOutcome(m, { success: true });
    expect(evaluateLifecycle(m)).toBe("promoted");
    expect(m.lifecycle.status).toBe("active");
  });

  it("试用不达标 → fired", () => {
    const m = makeManifest({ lifecycle: { status: "probation" } });
    m.evaluation.metrics.quality = 40; // 低于地板
    m.evaluation.metrics.hire_count = 3;
    recordOutcome(m, { success: false });
    expect(evaluateLifecycle(m)).toBe("fired");
    expect(m.lifecycle.status).toBe("fired");
  });

  it("在岗跌破红线 → 暂停；复活 → 复岗", () => {
    const m = makeManifest({ lifecycle: { status: "active" } });
    m.evaluation.metrics.quality = 40;
    expect(evaluateLifecycle(m)).toBe("suspended");
    expect(m.lifecycle.status).toBe("suspended");
    revive(m);
    expect(m.lifecycle.status).toBe("active");
  });

  it("fired 复活 → 回 probation（重过闸门二）", () => {
    const m = makeManifest({ lifecycle: { status: "fired" } });
    revive(m);
    expect(m.lifecycle.status).toBe("probation");
  });
});

describe("排名：质量地板 + 性价比（第 14 条）", () => {
  it("低于地板者不进排行；过线者按性价比降序", () => {
    const good = makeManifest({
      id: "good",
      role: "secretary",
      lifecycle: { status: "active" },
      provenance: { source: "i", source_ref: "r1", original_author: "p" },
    });
    good.evaluation.metrics.quality = 90;
    good.evaluation.metrics.avg_cost = 0.01;

    const cheapBad = makeManifest({
      id: "cheapbad",
      role: "secretary",
      lifecycle: { status: "active" },
      provenance: { source: "i", source_ref: "r2", original_author: "p" },
    });
    cheapBad.evaluation.metrics.quality = 50; // 低于地板 60
    cheapBad.evaluation.metrics.avg_cost = 0.001;

    const ranked = rankRole([good, cheapBad], "secretary", DEFAULT_PARAMS, 60);
    expect(ranked.length).toBe(1); // cheapBad 被地板挡掉
    expect(ranked[0]!.id).toBe("good");
    expect(ranked[0]!.value).toBeGreaterThan(0);
  });
});
