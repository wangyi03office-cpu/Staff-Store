/**
 * T2.5 · 店面 HTTP 服务（node:http，极简）
 * 路由：
 *   GET  /                → 网页（列表 + 雇佣表单）
 *   GET  /api/employees   → JSON 列表
 *   POST /api/hire        → {employeeId, input} → 运行+结算，返回交付物与回执
 */
import { createServer as createHttp, type Server } from "node:http";
import type { SeededWorld } from "../seed/seed.js";
import type { LLMClient } from "../runtime/llm.js";
import { listStore } from "./store.js";
import { hireEmployee } from "../economy/hire.js";
import { GeminiLLM } from "../llm/gemini.js";

function html(world: SeededWorld): string {
  const manifests = world.registry.listManifests((m) => m.lifecycle.status === "active");
  const cards = manifests
    .map((m) => {
      const featured = m.id === "industry-intelligence-analyst";
      const fee = m.economics.base_fee ?? "—";
      const tags = m.tags.map((t) => `<span class="tag">${t}</span>`).join("");
      const action = featured
        ? `<input id="industry-input" class="field" placeholder="例如：新能源汽车" autocomplete="off">
        <button class="btn btn-accent" onclick="analyze()">立即咨询</button>`
        : `<button class="btn" onclick="hire('${m.id}')">立即咨询</button>`;
      return `<div class="card${featured ? " featured" : ""}">
      ${featured ? `<div class="ribbon">★ 推荐</div>` : ""}
      <div class="name">${m.name}</div>
      <div class="desc">${m.description}</div>
      <div class="tags">${tags}</div>
      <div class="row"><span class="fee">${fee}<small> CC/次</small></span></div>
      ${action}
    </div>`;
    })
    .join("");

  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>数字员工商店</title>
<style>
  :root{--bg:#0f172a;--card:#1e293b;--primary:#6366f1;--accent:#f59e0b;--text:#e2e8f0;--muted:#94a3b8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}
  .wrap{max-width:480px;margin:0 auto;padding:20px 16px 48px}
  header{text-align:center;padding:8px 0 16px}
  header h1{margin:0;font-size:1.7rem;font-weight:800;letter-spacing:1px;background:linear-gradient(90deg,#818cf8,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent}
  header p{margin:8px 0 0;color:var(--muted);font-size:.9rem}
  .card{position:relative;background:var(--card);border-radius:18px;padding:20px;margin:16px 0;box-shadow:0 6px 20px rgba(0,0,0,.35);border:1px solid #273349;overflow:hidden}
  .card.featured{border:1.5px solid var(--accent);box-shadow:0 10px 30px rgba(245,158,11,.20)}
  .ribbon{position:absolute;top:16px;right:0;background:var(--accent);color:#1f2937;font-weight:800;font-size:.74rem;padding:4px 14px;border-radius:10px 0 0 10px}
  .name{font-size:1.3rem;font-weight:800;margin-bottom:8px}
  .featured .name{color:var(--accent)}
  .desc{color:var(--muted);font-size:.92rem;margin-bottom:14px}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
  .tag{background:rgba(99,102,241,.18);color:#c7d2fe;font-size:.74rem;padding:4px 11px;border-radius:999px}
  .row{display:flex;align-items:baseline;margin-bottom:16px}
  .fee{color:var(--accent);font-size:1.6rem;font-weight:800}
  .fee small{color:var(--muted);font-size:.8rem;font-weight:500}
  .field{width:100%;padding:14px;margin-bottom:10px;border-radius:12px;border:1px solid #334155;background:#0f172a;color:var(--text);font-size:1.05rem}
  .field::placeholder{color:#64748b}
  .btn{display:block;width:100%;padding:15px;border:0;border-radius:14px;background:var(--primary);color:#fff;font-size:1.08rem;font-weight:700;cursor:pointer}
  .btn:active{transform:scale(.98)}
  .btn-accent{background:var(--accent);color:#1f2937}
  #out{display:none;background:var(--card);border:1px solid #334155;border-radius:14px;padding:16px;margin-top:10px;white-space:pre-wrap;font-size:.92rem;color:#cbd5e1;line-height:1.7}
  #out.show{display:block}
  footer{text-align:center;color:#475569;font-size:.75rem;margin-top:28px}
</style></head><body>
<div class="wrap">
  <header><h1>数字员工商店</h1><p>AI 原生 · 自我繁殖的数字员工</p></header>
  ${cards}
  <div id="out"></div>
  <footer>Staff Store · 计价单位 CC（算力币）· 演示环境</footer>
</div>
<script>
function show(t){var o=document.getElementById('out');o.className='show';o.textContent=t;o.scrollIntoView({behavior:'smooth'});}
async function analyze(){
  var el=document.getElementById('industry-input');
  var industry=((el&&el.value)||'').trim()||'新能源汽车';
  show('⏳ 正在联网生成「'+industry+'」行业情报，请稍候（可能需要十几秒）…');
  try{
    var r=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({industry:industry})});
    var j=await r.json();
    if(j.error){show('出错了：'+j.error);return;}
    var head=(j.grounded?'🌐 联网情报':'📄 示例报告')+'　|　'+j.industry+'\\n\\n';
    var note=j.note?('\\n\\n— '+j.note):'';
    show(head+j.report+note);
  }catch(e){show('请求失败：'+e);}
}
async function hire(id){
  var input=prompt('给 TA 一个主题（如：AI 行业）','AI 行业');
  if(input===null)return; if(!input.trim())input='AI 行业';
  show('⏳ 正在生成…');
  try{
    var r=await fetch('/api/hire',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({employeeId:id,input:input})});
    var j=await r.json();
    if(j.error){show('出错了：'+j.error);return;}
    show('【交付物】\\n'+j.deliverable+'\\n\\n总支出 '+j.totalSpend.toFixed(4)+' CC');
  }catch(e){show('请求失败：'+e);}
}
</script></body></html>`;
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

/** 无 GEMINI_API_KEY 时的结构化示例报告（六维信号 + 建议）。 */
function mockReport(industry: string): string {
  return [
    `${industry} · 行业情报报告（示例）`,
    ``,
    `【市场情绪】当前 ${industry} 板块情绪中性偏谨慎，散户关注度回落，机构观望为主。`,
    `【政策变化】近期暂无重大政策落地，需关注后续补贴与监管动向。`,
    `【科技突破】核心技术迭代平稳，暂无颠覆性突破进入规模量产。`,
    `【融资情况】一级市场融资降温，头部企业现金流稳健、负债可控。`,
    `【投资者热情】机构仓位中性，分析师评级以“持有”为主。`,
    `【当前建议】结论：继续等待。等待“悲观情绪顶点 + 业绩底 + 政策拐点”三重共振再建仓。`,
  ].join("\n");
}

export function createServer(world: SeededWorld, llm: LLMClient): Server {
  return createHttp(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html(world));
        return;
      }
      if (req.method === "GET" && req.url === "/api/employees") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(listStore(world.registry)));
        return;
      }
      if (req.method === "POST" && req.url === "/api/hire") {
        const { employeeId, input } = JSON.parse(await readBody(req)) as {
          employeeId: string;
          input: string;
        };
        const m = world.registry.getManifest(employeeId);
        if (!m) {
          res.writeHead(404).end(JSON.stringify({ error: "无此员工" }));
          return;
        }
        const receipt = await hireEmployee(
          { ledger: world.ledger, params: world.params, llm },
          m,
          world.hirer,
          input,
        );
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(receipt));
        return;
      }
      if (req.method === "POST" && req.url === "/api/analyze") {
        const parsed = JSON.parse(await readBody(req)) as { industry?: string };
        const industry = (parsed.industry ?? "").trim() || "新能源汽车";

        const analyst = world.registry.getManifest("industry-intelligence-analyst");
        const sys =
          (analyst?.execution.spec["system_prompt"] as string | undefined) ??
          "你是一位专业的行业情报分析师。";

        // 未配置 GEMINI_API_KEY → 返回结构化示例报告（说明需配置 key）。
        if (!GeminiLLM.isConfigured()) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              industry,
              grounded: false,
              report: mockReport(industry),
              note: "未配置 GEMINI_API_KEY，以上为示例报告；配置后将返回 Gemini 联网生成的真实情报。",
            }),
          );
          return;
        }

        // 已配置 → 调用 Gemini（gemini-2.0-flash-exp + google_search grounding）。
        const userInput =
          `请针对【${industry}】行业，基于联网检索到的最新公开信息，输出一份结构化情报报告。` +
          `必须包含以下六个小节，每节 2–4 句并给出具体信号：\n` +
          `1. 市场情绪\n2. 政策变化\n3. 科技突破\n4. 融资情况\n5. 投资者热情\n` +
          `6. 当前建议（明确给出“买入”或“等待”，说明理由与置信度）\n` +
          `免责声明：仅供参考，不构成投资建议。`;
        const gemini = new GeminiLLM();
        const result = await gemini.complete(sys, userInput, "gemini-2.0-flash-exp");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            industry,
            grounded: true,
            model: result.model,
            report: result.text,
            tokens: { input: result.inputTokens, output: result.outputTokens },
          }),
        );
        return;
      }
      res.writeHead(404).end("not found");
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
}
