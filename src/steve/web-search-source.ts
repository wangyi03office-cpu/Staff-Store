/**
 * WebSearchSource 适配器
 * 通过 Brave Search API（或 DuckDuckGo 免费端点）从公开网络发现真实 skill。
 * 搜索结果映射为内部 RawSkill，供 Steve 漏斗处理。
 *
 * 使用方式：
 *   const adapter = new WebSearchSource({ apiKey: process.env.BRAVE_API_KEY! });
 *   const result = await scan(adapter, registry);
 *
 * 注意：此适配器在单元测试中不使用（测试继续用 FixtureAdapter 离线运行）。
 * 在生产/集成场景中替换 FixtureAdapter 即可接入真实网络。
 */
import type { SourceAdapter, RawSkill } from "./source.js";

export interface WebSearchSourceOptions {
  /** Brave Search API Key；若未提供则回退到 DuckDuckGo 免费端点 */
  apiKey?: string;
  /** 搜索关键词列表，默认覆盖常见 AI skill 场景 */
  queries?: string[];
  /** 每次搜索最多取多少条结果（Brave 上限 20，DuckDuckGo 不分页） */
  perQuery?: number;
}

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  age?: string; // 发布时间（可选）
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

const DEFAULT_QUERIES = [
  "AI agent skill github site:github.com",
  "claude skill SKILL.md github",
  "anthropic skills marketplace agent",
];

/**
 * 将搜索结果 URL 转换为 GitHub source_ref（如果来自 GitHub）
 * 例：https://github.com/acme/repo → github.com/acme/repo
 */
function toSourceRef(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/blob/")[0]!;
}

/**
 * 从 URL 或标题中猜测版本（占位：真实实现应查 GitHub tags API）
 */
function guessVersion(_url: string): string {
  return "0.0.0"; // 占位；后续可调 GitHub releases API
}

/**
 * 简单地从 URL 中猜测作者（GitHub 第一段路径）
 */
function guessAuthor(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 判断 URL 是否来自 GitHub
 */
function isGitHub(url: string): boolean {
  return url.includes("github.com");
}

export class WebSearchSource implements SourceAdapter {
  name = "web-search";

  private readonly apiKey: string | undefined;
  private readonly queries: string[];
  private readonly perQuery: number;

  constructor(options: WebSearchSourceOptions = {}) {
    this.apiKey = options.apiKey;
    this.queries = options.queries ?? DEFAULT_QUERIES;
    this.perQuery = options.perQuery ?? 10;
  }

  async fetch(): Promise<RawSkill[]> {
    const all: RawSkill[] = [];
    const seen = new Set<string>();

    for (const query of this.queries) {
      const results = this.apiKey
        ? await this.fetchBrave(query)
        : await this.fetchDuckDuckGo(query);

      for (const r of results) {
        const ref = toSourceRef(r.url);
        if (seen.has(ref)) continue; // 去重
        seen.add(ref);

        all.push({
          source: isGitHub(r.url) ? "github" : "web",
          source_ref: ref,
          upstream_version: guessVersion(r.url),
          name: r.title.slice(0, 80),
          description: r.description?.slice(0, 200) ?? "",
          author: guessAuthor(r.url),
          license: null, // 网络搜索无法直接获取，Steve 漏斗会在 licenseAllowed(null) 处理
          stars: 0, // 占位；后续可调 GitHub API 补充
          archived: false,
          hasSkillMd: r.url.includes("SKILL.md") || r.description?.includes("SKILL.md") === true,
        });
      }
    }

    return all;
  }

  // ---- Brave Search ----

  private async fetchBrave(query: string): Promise<BraveWebResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(this.perQuery));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": this.apiKey!,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search 请求失败: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as BraveSearchResponse;
    return data.web?.results ?? [];
  }

  // ---- DuckDuckGo 免费 Instant Answer API（仅返回摘要，非全量结果）----

  private async fetchDuckDuckGo(query: string): Promise<BraveWebResult[]> {
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "StaffStore/0.1 (skill-discovery-bot)" },
    });

    if (!res.ok) {
      throw new Error(`DuckDuckGo 请求失败: ${res.status}`);
    }

    type DDGResponse = {
      AbstractURL?: string;
      AbstractText?: string;
      Heading?: string;
      RelatedTopics?: Array<{ FirstURL?: string; Text?: string }>;
    };

    const data = (await res.json()) as DDGResponse;
    const results: BraveWebResult[] = [];

    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading ?? query,
        url: data.AbstractURL,
        description: data.AbstractText,
      });
    }

    for (const topic of data.RelatedTopics ?? []) {
      if (topic.FirstURL && topic.Text) {
        results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, description: topic.Text });
      }
    }

    return results.slice(0, this.perQuery);
  }
}
