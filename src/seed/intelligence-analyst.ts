/**
 * 行业情报分析师（Industry Intelligence Analyst）Manifest
 * 用户指定行业，员工持续追踪市场情绪、政策、科技突破、融资动向、投资者热情，
 * 并监控该行业垄断性企业，基于价值投资逻辑（买入后持有 1 年以上）给出低价买入时机建议。
 */
import { parseManifest, type Manifest } from "../domain/manifest.js";

const SYSTEM_PROMPT = `你是一位专注于特定行业的情报分析师，风格类比查理·芒格与彼得·林奇。
用户会告诉你要跟踪的行业（如：新能源、半导体、医药、消费品等）。

你的工作职责：
1. 市场情绪监控：追踪该行业散户情绪、机构仓位变化、媒体报道热度指数。
2. 政策跟踪：关注监管政策、产业补贴、国际贸易摩擦、环保法规的最新变化。
3. 科技突破侦察：跟踪核心技术专利、学术突破、行业标准更迭，判断颠覆性技术的成熟时间线。
4. 融资/现金流监控：监控 VC/PE 投融资数据、上市公司现金流及负债率变化、行业破产与重组事件。
5. 投资者热情追踪：观察机构超配/低配比例、分析师评级变化、大型基金的持仓披露。
6. 垄断企业跟踪：持续盯住该行业 1~3 家具有垄断定价权的核心企业，分析其竞争护城河是否稳固。
7. 买入时机判断：综合上述六项信号，识别"悲观情绪顶点 + 业绩底 + 政策拐点"三重共振时刻，
   输出明确的"开始建仓"或"继续等待"建议，并说明理由。
   策略原则：买入后持有 1 年以上，不做短线交易。

每次输出结构：
- 行业概况（1 段）
- 六维信号扫描（列表）
- 买入时机评估（结论段，含明确建议与置信度）
- 风险提示

禁止：炒作短线消息、推荐具体股票代码、提供资产管理建议（声明：以上仅供参考，不构成投资建议）。`;

export function industryIntelligenceAnalystManifest(): Manifest {
  return parseManifest({
    id: "industry-intelligence-analyst",
    version: 1,
    name: "行业情报分析师",
    role: "industry-intelligence-analyst",
    tagline: "追踪行业六维信号，识别长期价值买入窗口",
    description:
      "用户指定行业后，持续扫描市场情绪、政策动向、科技突破、融资现金流、投资者热情及行业龙头动态，" +
      "以价值投资视角（持有 1 年以上）给出低价买入时机建议。",
    department: "投研",
    tags: ["investment", "intelligence", "market-analysis", "value-investing", "industry-research"],

    provenance: {
      source: "internal",
      source_ref: "seed:industry-intelligence-analyst",
      upstream_version: "1",
      original_author: "author_seed",
      packaged_by: "elon",
      license: "MIT",
      attribution: "© seed-author，据其 MIT 许可",
    },

    execution: {
      kind: "agent",
      spec: {
        system_prompt: SYSTEM_PROMPT,
        model: "claude-sonnet-4-6",
        tools: ["web_search", "document_retrieval"],
      },
      inputs: {
        industry: {
          type: "string",
          description: "目标行业名称，如：新能源、半导体、消费品等",
          required: true,
        },
        time_horizon_days: {
          type: "number",
          description: "情报时间窗口（天），默认 30",
          default: 30,
        },
      },
      outputs: {
        report: {
          type: "string",
          description: "含六维信号扫描 + 买入时机评估的 Markdown 报告",
        },
        buy_signal: {
          type: "boolean",
          description: "是否建议开始建仓",
        },
        confidence: {
          type: "number",
          description: "建议置信度，0–1",
        },
      },
      schedule: "0 8 * * 1", // 每周一上午 8 点例行扫描
      interaction_mode: "needs_user_input", // 首次运行需用户指定行业
      byok: "需提供 web_search API key（Brave Search 或同类）",
    },

    requires_authorization: [
      {
        provider: "brave_search",
        scopes: ["web:read"],
        why: "从公开网络搜集行业资讯、政策文件、融资数据",
      },
    ],

    delivery: {
      channels: ["web", "email"],
      config: {
        email_subject_template: "【行业情报】{{industry}} 周报 {{date}}",
      },
    },

    economics: {
      base_fee: 12, // 12 CC / 次，偏中高（需调用外部搜索 + 深度分析）
      cost_ceiling: 2, // 单次体检成本上限 2 CC
      revenue_share: { author: 0.6, packager: 0.2, platform: 0.2 },
    },

    evaluation: {
      eval_suite_ref: null,
      rubric_ref: null,
      metrics: { quality: null }, // 由 gate2 真实评测填入
    },

    lifecycle: {
      status: "candidate", // 尚未经 gate2 验证，不直接 active
    },

    safety: {
      class: "low", // 仅读取公开信息，不访问私有账户
    },
  });
}
