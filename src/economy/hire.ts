/**
 * T2.4 · 雇佣 + 结算
 * 运行员工 → 计量算力 → 按 加成=岗位基准费×质量系数 结算 CC：
 *   借雇主、贷 作者/打包者/平台（第 18/19 条），Σ=0。
 * 算力(法币/BYOK)在平台外，不入账本；只有加成(CC)入账。
 */
import type { Manifest } from "../domain/manifest.js";
import type { Ledger, Posting } from "../ledger/ledger.js";
import { type MonetaryParams, baseFeeFor } from "../ledger/config.js";
import type { LLMClient } from "../runtime/llm.js";
import { runEmployee } from "../runtime/runner.js";
import { markupFor, totalSpend, valueScore } from "./pricing.js";

export interface HireDeps {
  ledger: Ledger;
  params: MonetaryParams;
  llm: LLMClient;
}

export interface HireReceipt {
  employeeId: string;
  deliverable: string;
  computeCost: number; // 算力（BYOK，平台外）
  markup: number; // 加成（CC，平台内）
  totalSpend: number; // 用户总支出
  posting: Posting; // CC 结算记录
}

const STUB_QUALITY = 50; // 无质量分时的兜底（M2 stub；M3 起为真实评分）

export async function hireEmployee(
  deps: HireDeps,
  m: Manifest,
  hirer: string,
  input: string,
): Promise<HireReceipt> {
  const { ledger, params, llm } = deps;

  const run = await runEmployee(m, input, llm);
  const quality = m.evaluation.metrics.quality ?? STUB_QUALITY;
  const baseFee = m.economics.base_fee ?? baseFeeFor(params, m.role);
  const markup = markupFor(baseFee, quality);

  const rs = m.economics.revenue_share;
  const author = m.provenance.original_author;
  const packager = m.provenance.packaged_by ?? params.platformAccountId;

  // 结算：借雇主、贷 作者/打包者/平台（平台那份即"加成税"，第 19/28.4 条）
  const posting = ledger.post(
    [
      { account: hirer, amount: -markup },
      { account: author, amount: +markup * rs.author },
      { account: packager, amount: +markup * rs.packager },
      { account: params.platformAccountId, amount: +markup * rs.platform },
    ],
    "settlement",
    `雇佣 ${m.id}（加成 ${markup.toFixed(2)}CC）`,
  );

  // 更新指标
  const metrics = m.evaluation.metrics;
  const n = metrics.hire_count;
  metrics.avg_cost =
    metrics.avg_cost == null ? run.computeCost : (metrics.avg_cost * n + run.computeCost) / (n + 1);
  metrics.hire_count = n + 1;
  const total = totalSpend(run.computeCost, markup);
  metrics.value = valueScore(quality, total);

  return {
    employeeId: m.id,
    deliverable: run.deliverable,
    computeCost: run.computeCost,
    markup,
    totalSpend: total,
    posting,
  };
}
