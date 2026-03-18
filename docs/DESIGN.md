# AI 工作流编排平台 - 架构设计

## 一、整体项目结构

```
ai-workflow-platform/
├── apps/
│   ├── api/                    # NestJS 后端
│   │   ├── src/
│   │   │   ├── workflow/       # 工作流 CRUD、版本
│   │   │   ├── execution/      # 执行引擎、队列、重试
│   │   │   ├── nodes/          # 节点执行器（AI/HTTP/条件等）
│   │   │   ├── ai/             # AI 提供商抽象（OpenAI/百炼/本地）
│   │   │   ├── tools/          # 工具节点（HTTP/DB）
│   │   │   ├── logs/           # 执行日志与调试
│   │   │   └── common/         # 共享 DTO、装饰器、管道
│   │   ├── prisma/             # 或 typeorm 实体
│   │   └── test/
│   │
│   └── web/                    # React 前端
│       ├── src/
│       │   ├── components/     # 通用组件
│       │   ├── features/       # 按功能模块
│       │   │   ├── workflow-editor/  # 画布、节点、连线
│       │   │   ├── node-config/      # 节点配置面板
│       │   │   ├── execution/        # 运行、日志、调试
│       │   │   └── projects/         # 项目/工作流列表
│       │   ├── stores/         # 状态（Zustand/Jotai）
│       │   ├── api/            # API 客户端
│       │   └── types/          # 与后端对齐的 TS 类型
│       └── public/
│
├── packages/                   # 可选：共享类型/常量
│   └── shared-types/
│       └── src/
│           ├── workflow.ts
│           ├── node.ts
│           └── index.ts
│
├── docker-compose.yml          # PostgreSQL + Redis
├── docs/
│   └── DESIGN.md               # 本文件
└── README.md
```

## 二、核心数据结构

### 2.1 Workflow（工作流）

```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  version: number;
  graph: WorkflowGraph;      // nodes + edges
  variables?: Variable[];    // 全局变量/入参
  createdAt: string;
  updatedAt: string;
}

interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}
```

### 2.2 Node（节点）

```typescript
type NodeType = 'trigger' | 'ai' | 'http' | 'database' | 'condition_if' | 'condition_switch' | 'code' | 'aggregate';

interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;  // 各类型专属配置
  width?: number;
  height?: number;
}

// 各类型 data 示例
interface AINodeData {
  provider: 'openai' | 'bailian' | 'local';
  model: string;
  systemPrompt?: string;
  inputMapping: Record<string, string>;  // 变量/上游输出 -> 输入
}

interface HttpNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;               // 支持 {{variable}} 模板
  headers?: Record<string, string>;
  body?: string;
}

interface ConditionIfData {
  expression: string;        // 如 "{{inputs.score}} > 60"
  trueOutput?: string;
  falseOutput?: string;
}
```

### 2.3 Edge（连线）

```typescript
interface WorkflowEdge {
  id: string;
  source: string;            # 源节点 id
  target: string;            # 目标节点 id
  sourceHandle?: string;     # 条件节点多出口时使用
  targetHandle?: string;
}
```

### 2.4 执行相关

```typescript
interface RunRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  nodeLogs?: NodeRunLog[];
}

interface NodeRunLog {
  nodeId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'success' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}
```

## 三、MVP 实现方案

### 阶段 1：可运行骨架（1–2 周）

- **后端**
  - NestJS 项目初始化，PostgreSQL（Prisma）+ Redis 连接。
  - 工作流 CRUD API（存 graph JSON）。
  - 执行 API：接收 workflowId + inputs，同步执行简单 DAG（无 AI/HTTP，仅透传数据）。
- **前端**
  - React + TypeScript + React Flow，单页「工作流编辑」。
  - 从 API 拉取/保存 workflow graph（nodes + edges）。
  - 占位节点类型：start、end、plain（仅透传），无配置面板也可。

### 阶段 2：AI 节点 + 执行引擎（2–3 周）

- **后端**
  - AI 提供商抽象：OpenAI 实现，预留百炼/本地接口。
  - 执行引擎：按 DAG 拓扑排序执行，识别 ai 节点并调用 LLM，结果写入上下文供下游节点使用。
  - 简单重试（仅 AI 节点，可配置次数与 backoff）。
- **前端**
  - 新增 AI 节点，配置面板：模型、system prompt、输入映射。
  - 运行按钮 → 调用执行 API，展示运行结果/简单日志。

### 阶段 3：工具节点 + 条件节点（2 周）

- **后端**
  - HTTP 节点：执行 HTTP 请求，支持变量替换。
  - 条件节点：if（单条件）、switch（多分支），基于表达式或简单 key 匹配。
- **前端**
  - 对应节点类型与配置面板，连线支持多出口（condition 的 handle）。

### 阶段 4：异步、队列、日志（2–3 周）

- **后端**
  - 执行改为异步：写入 Redis 队列，Worker 消费执行，结果写 DB。
  - RunRecord + NodeRunLog 落库，提供「运行历史」与「单次运行日志」API。
- **前端**
  - 运行后轮询或 WebSocket 查状态；日志/调试面板展示每节点输入输出与错误。

MVP 完成后即可得到：可视化编辑、AI/HTTP/条件节点、同步+异步执行、重试与基本日志调试。
