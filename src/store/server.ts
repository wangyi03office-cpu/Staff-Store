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

function html(world: SeededWorld): string {
  const rows = listStore(world.registry)
    .map(
      (e) =>
        `<tr><td><b>${e.name}</b><br><small>${e.tagline}</small></td><td>${e.role}</td><td>${e.quality ?? "—"}</td><td>${e.value?.toFixed(2) ?? "—"}</td><td>${e.hireCount}</td>
         <td><button onclick="hire('${e.id}')">雇佣</button></td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Staff Store</title>
<style>body{font-family:system-ui;max-width:820px;margin:0 auto;padding:1rem;line-height:1.5}h1{font-size:1.4rem}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:.6rem .4rem;text-align:left;font-size:.95rem}small{color:#666}button{padding:.55rem 1rem;font-size:1rem;border:0;background:#0a7a5a;color:#fff;border-radius:6px}#out{white-space:pre-wrap;background:#f6f6f6;padding:1rem;margin-top:1rem;border-radius:8px}</style>
</head><body>
<h1>Staff Store · 数字员工</h1>
<table><thead><tr><th>员工</th><th>岗位</th><th>质量</th><th>性价比</th><th>雇佣次数</th><th></th></tr></thead><tbody>${rows}</tbody></table>
<div id="out">点"雇佣"试试。</div>
<script>
async function hire(id){
  const input = prompt("给情报秘书一个主题（如：AI 行业）","AI 行业") || "AI 行业";
  const r = await fetch('/api/hire',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({employeeId:id,input})});
  const j = await r.json();
  document.getElementById('out').textContent =
    "交付物：\\n"+j.deliverable+"\\n\\n算力成本 "+j.computeCost.toFixed(4)+" | 加成 "+j.markup.toFixed(2)+"CC | 总支出 "+j.totalSpend.toFixed(4);
  setTimeout(()=>location.reload(), 1500);
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
      res.writeHead(404).end("not found");
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
}
