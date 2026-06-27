/**
 * DuckDuckGo Instant Answer 搜索（完全免费、无需 API key）。
 *
 * 用于在调用不自带联网的模型（如 Groq）前，抓取行业相关摘要注入 system prompt。
 * 取 AbstractText + 前 3 条 RelatedTopics[].Text，拼成一段参考资料。
 * 任何失败（网络/超时/无结果）都静默返回空串，不打断主流程。
 *
 * 网络边界：GET https://api.duckduckgo.com/?q={query}&format=json&t=h_
 * 说明：Instant Answer 偏百科类，未必有实时新闻；作为“尽力而为”的轻量联网增强。
 */

const DDG_ENDPOINT = "https://api.duckduckgo.com/";

export async function duckDuckGoSearch(query: string, timeoutMs = 8000): Promise<string> {
  const url = `${DDG_ENDPOINT}?q=${encodeURIComponent(query)}&format=json&t=h_`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // <<< NETWORK BOUNDARY — DuckDuckGo Instant Answer
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return "";
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = (await res.json()) as any;
    // >>> END NETWORK BOUNDARY

    const parts: string[] = [];
    if (typeof data?.AbstractText === "string" && data.AbstractText.trim()) {
      parts.push(data.AbstractText.trim());
    }
    const related: any[] = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
    /* eslint-enable @typescript-eslint/no-explicit-any */
    let count = 0;
    for (const t of related) {
      if (count >= 3) break;
      const text = t && typeof t.Text === "string" ? t.Text.trim() : "";
      if (text) {
        parts.push(text);
        count++;
      }
    }
    return parts.join("\n");
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
