/**
 * Staff Store — 实现层入口
 * 启动种子世界 + 店面 HTTP 服务（M2）。隶属宪法 v1.21。
 */
import { existsSync, readFileSync } from "node:fs";
import { seedWorld } from "./seed/seed.js";
import { MockLLM } from "./runtime/llm.js";
import { createServer } from "./store/server.js";

/**
 * 零依赖 .env 加载：仅当文件存在时读取，且不覆盖已存在的环境变量
 * （命令行内联的 env 优先级更高）。避免引入 dotenv 依赖。
 */
function loadDotenv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function main(): void {
  loadDotenv();
  const world = seedWorld();
  const llm = new MockLLM();
  const server = createServer(world, llm);
  const port = Number(process.env["PORT"] ?? 3000);
  server.listen(port, () => {
    console.log(`Staff Store 店面已启动：http://localhost:${port}`);
    console.log(`种子员工：全球情报秘书（intel-secretary）· LLM=mock`);
  });
}

main();
