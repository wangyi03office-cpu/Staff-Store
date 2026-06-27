/**
 * T2.1 · 员工执行器
 * MVP 只实现 kind=agent（system_prompt + tools + model，BYOK key）。
 * skill / external-api 后续补。
 */
import type { Manifest } from "../domain/manifest.js";
import type { LLMClient } from "./llm.js";
import { meterCost } from "./metering.js";

export interface RunResult {
  deliverable: string;
  computeCost: number; // 算力成本（BYOK，第 13/27 条）
  tokens: { input: number; output: number };
  model: string;
}

export async function runEmployee(
  m: Manifest,
  input: string,
  llm: LLMClient,
): Promise<RunResult> {
  if (m.execution.kind !== "agent") {
    throw new Error(`MVP 暂只支持 kind=agent，收到 ${m.execution.kind}`);
  }
  const sys = String(m.execution.spec["system_prompt"] ?? "");
  const model = String(m.execution.spec["model"] ?? "claude-mock");
  const r = await llm.complete(sys, input, model);
  return {
    deliverable: r.text,
    computeCost: meterCost(r.inputTokens, r.outputTokens),
    tokens: { input: r.inputTokens, output: r.outputTokens },
    model: r.model,
  };
}
