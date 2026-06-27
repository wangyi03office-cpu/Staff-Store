import { describe, it, expect } from "vitest";
import { Registry } from "./registry.js";
import { makeManifest, makeCandidate } from "../test/fixtures.js";

describe("Registry 去重与更新（第 16 条）", () => {
  it("候选：首次 added", () => {
    const reg = new Registry();
    const r = reg.addCandidate(makeCandidate());
    expect(r.outcome).toBe("added");
    expect(reg.counts().candidates).toBe(1);
  });

  it("候选：同源同版 → duplicate，不重复建档", () => {
    const reg = new Registry();
    reg.addCandidate(makeCandidate({ id: "c1", upstream_version: "1" }));
    const r = reg.addCandidate(makeCandidate({ id: "c2", upstream_version: "1" }));
    expect(r.outcome).toBe("duplicate");
    expect(r.record.id).toBe("c1"); // 返回既有
    expect(reg.counts().candidates).toBe(1);
  });

  it("候选：同源新版 → updated，沿用原 id", () => {
    const reg = new Registry();
    reg.addCandidate(makeCandidate({ id: "c1", upstream_version: "1" }));
    const r = reg.addCandidate(makeCandidate({ id: "c2", upstream_version: "2" }));
    expect(r.outcome).toBe("updated");
    expect(r.record.id).toBe("c1");
    expect(r.record.upstream_version).toBe("2");
    expect(reg.counts().candidates).toBe(1);
  });

  it("manifest：同源新版 → updated 且 version+1", () => {
    const reg = new Registry();
    reg.upsertManifest(
      makeManifest({
        id: "m1",
        provenance: {
          source: "github",
          source_ref: "ref_x",
          original_author: "a",
          upstream_version: "1",
        },
      }),
    );
    const r = reg.upsertManifest(
      makeManifest({
        id: "m2",
        provenance: {
          source: "github",
          source_ref: "ref_x",
          original_author: "a",
          upstream_version: "2",
        },
      }),
    );
    expect(r.outcome).toBe("updated");
    expect(r.record.id).toBe("m1");
    expect(r.record.version).toBe(2);
    expect(reg.counts().manifests).toBe(1);
  });

  it("按岗位取（第 14 条同岗排名前置）", () => {
    const reg = new Registry();
    reg.upsertManifest(makeManifest({ id: "a", role: "secretary", provenance: { source: "i", source_ref: "r1", original_author: "p" } }));
    reg.upsertManifest(makeManifest({ id: "b", role: "secretary", provenance: { source: "i", source_ref: "r2", original_author: "p" } }));
    reg.upsertManifest(makeManifest({ id: "c", role: "lawyer", provenance: { source: "i", source_ref: "r3", original_author: "p" } }));
    expect(reg.listByRole("secretary").length).toBe(2);
    expect(reg.listByRole("lawyer").length).toBe(1);
  });
});
