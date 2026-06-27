# Staff Store（实现层）

一家 AI 原生、自我繁殖的"数字员工"公司的 MVP 实现。设计纲领见 [docs/CONSTITUTION.md](docs/CONSTITUTION.md)（宪法 v1.21）及 `docs/` 下四份手册（Steve / Elon / 岗位Rubric框架 / 经营者继任规格）。

> 技术栈：Node.js + TypeScript · LLM 初期 mock（离线可端到端跑）· 存储先内存。

## 跑起来

```bash
npm install
npm run typecheck   # 类型检查
npm test            # 全部单测（33 项）
npm run e2e         # 端到端验收（人读版，打印整条飞轮）
npm start           # 启动店面 http://localhost:3000
```

## 核心飞轮（已跑通）

```
Steve 扫描发现 → Elon 打包 → 独立闸门二体检 → 上架(probation)
   → 试用运营 → 转正(active) → 店面雇佣 → CC 结算 → 闸门三监控 → 同岗排名
```

`npm run e2e` 会演示：扫 6 条源 → 1 个过四门槛 → 打包过闸门二 → 试用转正 →
与手种员工同岗排名（质量地板 + 性价比）→ 真实雇佣交付 → 账本 Σ=0、哈希链完好。

## 模块地图

| 目录 | 内容 | 宪法依据 |
|---|---|---|
| `src/domain` | manifest / 候选档案 类型 + 校验 | 第六章、§7 |
| `src/registry` | 内存注册表 + 去重 | 第 16 条 |
| `src/ledger` | CC 互助信用账本（Σ=0、央行操作、哈希链） | 第 26/28 条 |
| `src/runtime` | LLM 客户端(mock) / 执行器 / 计量 | 第 13/27 条 |
| `src/rubric` | Rubric 结构 + 评分函数 + 多裁判 + 校准 | Rubric 框架 |
| `src/steve` | 发现漏斗（源适配器 / 许可证 / 闸门一） | Steve 规程、第 9 条 |
| `src/elon` | 打包 + 自测 | Elon 规程 |
| `src/gate` | 闸门二（体检）/ 闸门三（监控） | 第 7/8 条 |
| `src/economy` | 定价 / 雇佣结算 / 排名 | 第 18/19/14 条 |
| `src/lifecycle` | 状态机转移 | 第 21 条 |
| `src/pipeline` | 全自动闭环 + 验收 | — |
| `src/store` | 店面服务 + HTTP | 第 14 条 |

## MVP 边界

- LLM / 裁判 / 安全探针 / 源适配器均为 mock / fixture（离线）；接真 Claude key 与真实源是下一步。
- 真实支付、密钥托管、组合性、机器客户等见 [任务清单.md](任务清单.md) 的"暂不做"。
- 已知缺口：打包岗自身替代者的"打包独立性"（Elon 规程 §1）。
