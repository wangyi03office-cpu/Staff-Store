/** 测试夹具：构造合法的 manifest / candidate。 */
import { parseManifest, type Manifest } from "../domain/manifest.js";
import { parseCandidate, type CandidateDossier } from "../domain/candidate.js";

export function makeManifest(overrides: Record<string, unknown> = {}): Manifest {
  return parseManifest({
    id: "emp_test",
    name: "Test Employee",
    role: "test-role",
    provenance: {
      source: "internal",
      source_ref: "ref_1",
      original_author: "platform",
    },
    execution: { kind: "agent" },
    economics: {
      revenue_share: { author: 0.5, packager: 0.3, platform: 0.2 },
    },
    lifecycle: { status: "active" },
    ...overrides,
  });
}

export function makeCandidate(
  overrides: Record<string, unknown> = {},
): CandidateDossier {
  return parseCandidate({
    id: "cand_test",
    proposed_name: "Test Candidate",
    proposed_role: "test-role",
    source: "github",
    source_ref: "github.com/acme/skill",
    original_author: "acme",
    discovered_at: new Date("2026-06-21").toISOString(),
    discovered_by: "steve@v0.4",
    recommendation: "recommend",
    ...overrides,
  });
}
