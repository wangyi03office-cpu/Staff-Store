/**
 * Gemini LLM 适配器（直连 generativelanguage REST API，不依赖额外 npm 包）
 *
 * - 实现与 MockLLM 相同的 LLMClient 接口（complete）。
 * - 默认模型 gemini-2.0-flash-exp，开启 google_search grounding（自带联网检索）。
 * - 需要环境变量 GEMINI_API_KEY；未配置时构造不报错，调用 complete 时才抛。
 *
 * 网络边界：POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */
import type { LLMClient, LLMResult } from "../runtime/llm.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  grounding?: boolean; // 开启 google_search 联网检索（默认 true）
  timeoutMs?: number;
}

export class GeminiLLM implements LLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly grounding: boolean;
  private readonly timeoutMs: number;

  constructor(opts: GeminiOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env["GEMINI_API_KEY"] ?? "";
    this.model = opts.model ?? "gemini-2.0-flash-exp";
    this.grounding = opts.grounding ?? true;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  /** 是否已配置 GEMINI_API_KEY（供调用方决定走真实/降级路径）。 */
  static isConfigured(): boolean {
    return Boolean(process.env["GEMINI_API_KEY"]);
  }

  // 注意：Gemini 适配器固定用自身配置的模型，忽略传入的 manifest model 名。
  async complete(systemPrompt: string, userInput: string, _model: string): Promise<LLMResult> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY 未配置");

    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userInput }] }],
    };
    if (this.grounding) body["tools"] = [{ google_search: {} }];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      // <<< NETWORK BOUNDARY — Gemini generateContent
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      // >>> END NETWORK BOUNDARY
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${raw.slice(0, 500)}`);

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Gemini 返回非 JSON: " + raw.slice(0, 200));
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const d = data as any;
    const parts: Array<{ text?: string }> = d?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) {
      throw new Error("Gemini 无文本输出: " + JSON.stringify(data).slice(0, 300));
    }
    const usage = d?.usageMetadata ?? {};
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      text,
      inputTokens:
        typeof usage.promptTokenCount === "number"
          ? usage.promptTokenCount
          : Math.ceil((systemPrompt.length + userInput.length) / 4),
      outputTokens:
        typeof usage.candidatesTokenCount === "number"
          ? usage.candidatesTokenCount
          : Math.ceil(text.length / 4),
      model: this.model,
    };
  }
}
