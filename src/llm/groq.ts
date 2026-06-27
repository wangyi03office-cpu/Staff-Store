/**
 * Groq LLM 适配器（直连 Groq OpenAI 兼容 REST API，不依赖额外 npm 包）
 *
 * - 实现与 MockLLM 相同的 LLMClient 接口（complete）。
 * - 默认模型 llama-3.1-70b-versatile（可用 GROQ_MODEL 覆盖；若该模型已下线，
 *   设 GROQ_MODEL=llama-3.3-70b-versatile 即可）。
 * - 需要环境变量 GROQ_API_KEY；未配置时构造不报错，调用 complete 时才抛。
 *
 * 网络边界：POST https://api.groq.com/openai/v1/chat/completions
 * 注：Groq 本身不联网，行业资讯由 websearch.ts（DuckDuckGo）抓取后注入 system prompt。
 */
import type { LLMClient, LLMResult } from "../runtime/llm.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GroqLLM implements LLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: GroqOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env["GROQ_API_KEY"] ?? "";
    this.model = opts.model ?? process.env["GROQ_MODEL"] ?? "llama-3.1-70b-versatile";
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** 是否已配置 GROQ_API_KEY（供调用方决定优先级/降级）。 */
  static isConfigured(): boolean {
    return Boolean(process.env["GROQ_API_KEY"]);
  }

  // Groq 适配器固定用自身配置的模型，忽略传入的 manifest model 名。
  async complete(systemPrompt: string, userInput: string, _model: string): Promise<LLMResult> {
    if (!this.apiKey) throw new Error("GROQ_API_KEY 未配置");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      // <<< NETWORK BOUNDARY — Groq chat completions
      res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInput },
          ],
          temperature: 0.6,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });
      // >>> END NETWORK BOUNDARY
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    if (!res.ok) throw new Error(`Groq API ${res.status}: ${raw.slice(0, 500)}`);

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Groq 返回非 JSON: " + raw.slice(0, 200));
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const d = data as any;
    const text = String(d?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      throw new Error("Groq 无文本输出: " + JSON.stringify(data).slice(0, 300));
    }
    const usage = d?.usage ?? {};
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      text,
      inputTokens:
        typeof usage.prompt_tokens === "number"
          ? usage.prompt_tokens
          : Math.ceil((systemPrompt.length + userInput.length) / 4),
      outputTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : Math.ceil(text.length / 4),
      model: this.model,
    };
  }
}
