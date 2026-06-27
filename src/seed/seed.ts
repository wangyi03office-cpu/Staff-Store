/**
 * T2.3 · 手种一个员工 manifest（测试夹具）+ 引导账户
 * "全球情报秘书"简版；质量分 stub=80；作者/打包者用平台占位开发者账户。
 * 后续由 Elon 真实产出取代（任务清单 T2.3 注）。
 */
import { Ledger } from "../ledger/ledger.js";
import { DEFAULT_PARAMS, type MonetaryParams, bootstrap, grant } from "../ledger/config.js";
import { Registry } from "../registry/registry.js";
import { parseManifest, type Manifest } from "../domain/manifest.js";
import { industryIntelligenceAnalystManifest } from "./intelligence-analyst.js";

export interface SeededWorld {
  ledger: Ledger;
  registry: Registry;
  params: MonetaryParams;
  hirer: string;
}

export function intelSecretaryManifest(): Manifest {
  return parseManifest({
    id: "intel-secretary",
    name: "全球情报秘书",
    role: "intelligence-secretary",
    tagline: "每天为你汇总前一天的全球资讯，像李嘉诚的私人情报秘书",
    description: "扫读全球公开资讯，按主题汇总成一份可直接读的早报。",
    department: "情报",
    tags: ["news", "briefing"],
    provenance: {
      source: "internal",
      source_ref: "seed:intel-secretary",
      upstream_version: "1",
      original_author: "author_seed",
      packaged_by: "elon",
      license: "MIT",
      attribution: "© seed-author，据其 MIT 许可",
    },
    execution: {
      kind: "agent",
      spec: {
        system_prompt:
          "你是用户的私人情报秘书。把输入的主题，整理成一份简洁、分点、可直接读的资讯早报。",
        model: "claude-mock",
      },
      schedule: "0 6 * * *",
    },
    delivery: { channels: ["web"] },
    economics: {
      base_fee: 10,
      revenue_share: { author: 0.6, packager: 0.2, platform: 0.2 },
    },
    evaluation: { metrics: { quality: 80 } }, // ← stub（M3 起换真实评分）
    lifecycle: { status: "active" },
  });
}

export function seedWorld(params: MonetaryParams = DEFAULT_PARAMS): SeededWorld {
  const ledger = new Ledger();
  bootstrap(ledger, params); // 平台央行账户
  ledger.openAccount("author_seed", "developer", params.defaultCreditLimit);
  ledger.openAccount("elon", "developer", params.defaultCreditLimit);
  ledger.openAccount("consumer_demo", "consumer", params.defaultCreditLimit);
  grant(ledger, params, "consumer_demo"); // 纯消费者经赠与进场（第 29 条）

  const registry = new Registry();
  registry.upsertManifest(intelSecretaryManifest());

  // 行业情报分析师：manifest 本身为 candidate（未过 gate2）；
  // 在 seed 演示层将其以 active 上架，使其出现在店面列表中。
  const analyst = industryIntelligenceAnalystManifest();
  registry.upsertManifest({
    ...analyst,
    lifecycle: { ...analyst.lifecycle, status: "active" },
  });

  return { ledger, registry, params, hirer: "consumer_demo" };
}
