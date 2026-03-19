# AI 工作流编排平台（类 Dify 低代码）

基于 React Flow + NestJS 的 AI 工作流编排 MVP，支持可视化编辑、保存与同步执行。

## 项目结构

```
ai-workflow-platform/
├── apps/
│   ├── api/          # NestJS 后端（工作流 CRUD + 执行引擎）
│   └── web/          # React + TypeScript + React Flow 前端
├── packages/
│   └── shared-types/ # 共享类型（Workflow / Node / Edge / Run）
├── docs/
│   └── DESIGN.md     # 架构与 MVP 阶段说明
└── README.md
```

## 核心数据结构（摘要）

- **Workflow**：id, name, version, graph(nodes, edges), variables
- **WorkflowNode**：id, type(start|end|plain|ai|http|condition_*), position, data
- **WorkflowEdge**：id, source, target, sourceHandle?, targetHandle?
- **RunRecord**：workflowId, status, inputs, outputs, nodeLogs

详见 `docs/DESIGN.md` 与 `packages/shared-types/src/`。

## 本地运行（MVP）

### 1. 环境

- Node.js 18+
- PostgreSQL（推荐 Docker，见下）
- Redis（推荐 Docker，见下；Phase 1 连接可选）
- 使用 AI 节点时需配置 `OPENAI_API_KEY`（见 `.env.example`）

### 2. 后端

```bash
cd apps/api
cp .env.example .env   # 配置 DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

API 默认：http://localhost:3001

### 3. 前端

```bash
cd apps/web
npm install
npm run dev
```

前端默认：http://localhost:3000，请求会通过 Vite 代理到 `/api` -> 3001。

### 4. 使用 Docker 运行 PostgreSQL + Redis（推荐）

在项目根目录执行：

```bash
docker compose up -d postgres redis
```

- **PostgreSQL**：`localhost:5436`，用户/密码/库名均为 `postgres`，与 `DATABASE_URL` 一致；数据持久化在 volume `postgres_data`。
- **Redis**：`localhost:6379`，与 `REDIS_URL` 一致；数据持久化在 volume `redis_data`。

停止：`docker compose down`（加 `-v` 会删除数据）。

## MVP 已实现（阶段 1 + 2）

- 工作流列表、新建、打开、保存（graph 存库）
- 可视化编辑器：拖拽画布、添加开始/结束/普通/**AI** 节点、连线
- **AI 节点**：配置模型、System Prompt、输入映射（`{{节点ID}}` 引用上游）；后端 OpenAI 实现，预留百炼/本地；执行时带重试
- 同步执行：按 DAG 拓扑执行 → AI 节点调 LLM → 结果写入上下文；RunRecord 含 nodeLogs 落库
- 运行结果：节点日志（每节点 input/output/status/error）+ 原始 JSON

## 后续阶段（见 DESIGN.md）

- AI 节点（OpenAI/百炼/本地）+ 重试
- HTTP / 条件节点
- 异步队列（Redis）、完整日志与调试面板
