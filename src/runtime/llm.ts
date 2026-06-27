/**
 * T2.1 · LLM 客户端接口 + Mock 实现
 * 初期 mock，使全链离线可端到端跑（任务清单全局决定）；后续接 Anthropic Claude SDK。
 */
export interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LLMClient {
  complete(systemPrompt: string, userInput: string, model: string): Promise<LLMResult>;
}

/** 离线 Mock：可注入自定义应答与 token 计数，便于测试。 */
export class MockLLM implements LLMClient {
  constructor(
    private opts: {
      responder?: (sys: string, input: string, model: string) => string;
      inTok?: number;
      outTok?: number;
    } = {},
  ) {}

  async complete(sys: string, input: string, model: string): Promise<LLMResult> {
    const text = this.opts.responder
      ? this.opts.responder(sys, input, model)
      : `【${model}·mock】针对「${input}」的交付物（基于系统提示词 ${sys.length} 字）。`;
    return {
      text,
      inputTokens: this.opts.inTok ?? Math.ceil((sys.length + input.length) / 4),
      outputTokens: this.opts.outTok ?? Math.ceil(text.length / 4),
      model,
    };
  }
}
