import { describe, it, expect } from "vitest";
import { scan } from "./steve.js";
import { FixtureAdapter } from "./source.js";
import { Registry } from "../registry/registry.js";

describe("里程碑 B · Steve 扫源产出候选档案", () => {
  it("漏斗各分支：好→候选，零件/坏证/垃圾/恶意→拒，重复→去重", async () => {
    const reg = new Registry();
    const res = await scan(new FixtureAdapter(), reg);

    expect(res.scanned).toBe(6);
    // 只有 ai-news-agent 过四门槛
    expect(res.candidates.length).toBe(1);
    expect(res.candidates[0]!.proposed_role).toBe("intelligence-secretary");
    expect(res.candidates[0]!.recommendation).toBe("recommend");

    // 重复 1 条
    expect(res.duplicates).toBe(1);

    // 拒绝：left-pad(零件) + premium-translator(证) + empty-repo(垃圾) + malware(安全) = 4
    expect(res.rejected.length).toBe(4);
    const reasons = res.rejected.map((r) => r.reason).join(" | ");
    expect(reasons).toMatch(/许可证不合规/); // premium-translator
    expect(reasons).toMatch(/客观垃圾/); // empty-repo
    expect(reasons).toMatch(/零件|闸门一/); // left-pad
    expect(reasons).toMatch(/安全|闸门一/); // malware

    // 候选已入注册表
    expect(reg.counts().candidates).toBe(1);
  });

  it("再次扫描：已建档 → 全部去重，不重复产出", async () => {
    const reg = new Registry();
    await scan(new FixtureAdapter(), reg);
    const res2 = await scan(new FixtureAdapter(), reg);
    expect(res2.candidates.length).toBe(0);
    expect(res2.duplicates).toBeGreaterThanOrEqual(1);
  });
});
