/**
 * Staff Store — 实现层入口
 * 启动种子世界 + 店面 HTTP 服务（M2）。隶属宪法 v1.21。
 */
import { seedWorld } from "./seed/seed.js";
import { MockLLM } from "./runtime/llm.js";
import { createServer } from "./store/server.js";

function main(): void {
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
