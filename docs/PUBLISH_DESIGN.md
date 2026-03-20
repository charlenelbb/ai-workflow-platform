# 发布功能设计（类 Dify）

## 1. 概念

| 概念 | 说明 |
|------|------|
| **Workflow** | 工作流编辑实体，状态为 `draft`（编辑中）或 `published`（已发布过）。当前画布即编辑该条 Workflow。 |
| **WorkflowVersion** | 每次点击「发布」生成一条版本记录，保存当时的完整快照，版本号递增。 |
| **App** | 发布后生成的应用，绑定某一条 WorkflowVersion，支持 API 调用与 Web 嵌入。 |
| **ApiKey** | App 的 API 密钥，用于鉴权；仅存储哈希，明文只在创建时返回一次。 |

## 2. 状态与流程

```
Workflow (draft) --[保存]--> 仍为 draft，version 可递增
Workflow (draft) --[发布]--> 创建 WorkflowVersion + 创建/更新 App，Workflow.status = published
后续再编辑 Workflow --> 仍为 draft，不影响已发布的 App（App 仍指向原 WorkflowVersion）
再次发布 --> 新建 WorkflowVersion，可将 App 指向新版本（或新建 App）
```

## 3. 数据库模型（Prisma）

见 `apps/api/prisma/schema.prisma`：

- **Workflow**：id, name, description, projectId, version, **status**, graph, variables, timestamps
- **WorkflowVersion**：id, workflowId, version, snapshot, publishedAt
- **App**：id, **appId**（对外唯一）, name, workflowId, workflowVersionId, timestamps
- **ApiKey**：id, appId, keyHash, name, lastUsedAt, createdAt

## 4. 示例数据结构

### 4.1 Workflow（表/文档）

```json
{
  "id": "clxx1234567890",
  "name": "客服问答流",
  "description": "接入知识库的客服对话",
  "projectId": null,
  "version": 3,
  "status": "published",
  "graph": {
    "nodes": [
      { "id": "input-1", "type": "input", "position": { "x": 0, "y": 0 }, "data": { "label": "输入", "assignments": { "message": "" } } },
      { "id": "ai-1", "type": "ai", "position": { "x": 200, "y": 0 }, "data": { "label": "AI", "inputMapping": { "user": "{{input-1.message}}" } },
      { "id": "output-1", "type": "output", "position": { "x": 400, "y": 0 }, "data": { "label": "输出", "outputMapping": { "reply": "{{ai-1.text}}" } }
    ],
    "edges": [
      { "id": "e1", "source": "input-1", "target": "ai-1" },
      { "id": "e2", "source": "ai-1", "target": "output-1" }
    ]
  },
  "variables": null,
  "createdAt": "2025-03-18T10:00:00.000Z",
  "updatedAt": "2025-03-18T12:00:00.000Z"
}
```

### 4.2 WorkflowVersion（每次发布一条）

```json
{
  "id": "clxx_version_abc",
  "workflowId": "clxx1234567890",
  "version": 2,
  "snapshot": {
    "name": "客服问答流",
    "description": "接入知识库的客服对话",
    "graph": {
      "nodes": [ "... 与发布时 graph 一致" ],
      "edges": [ "..." ]
    },
    "variables": null
  },
  "publishedAt": "2025-03-18T11:30:00.000Z"
}
```

### 4.3 App（发布后生成，API / 嵌入入口）

```json
{
  "id": "clxx_app_primary",
  "appId": "app_abc123xyz",
  "name": "客服问答",
  "workflowId": "clxx1234567890",
  "workflowVersionId": "clxx_version_abc",
  "createdAt": "2025-03-18T11:30:00.000Z",
  "updatedAt": "2025-03-18T11:30:00.000Z"
}
```

- **API 调用**：`POST /api/apps/{appId}/run`，Header `Authorization: Bearer <api_key>`，Body `{ "inputs": { "message": "你好" } }`。
- **Web 嵌入**：`GET /embed/{appId}` 或 iframe `src="/embed/{appId}"`，可带 `?api_key=xxx` 或 Cookie。

### 4.4 ApiKey（仅存哈希，明文创建时返回一次）

```json
{
  "id": "clxx_key_1",
  "appId": "clxx_app_primary",
  "keyHash": "sha256:...",
  "name": "生产环境",
  "lastUsedAt": "2025-03-18T14:00:00.000Z",
  "createdAt": "2025-03-18T11:35:00.000Z"
}
```

创建 ApiKey 时接口返回一次明文，例如：

```json
{
  "id": "clxx_key_1",
  "name": "生产环境",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "createdAt": "2025-03-18T11:35:00.000Z"
}
```

## 5. 建议 API 设计（后续实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /workflows/:id/publish | 发布：创建 WorkflowVersion，创建或更新 App |
| GET  | /workflows/:id/versions | 发布历史（WorkflowVersion 列表） |
| GET  | /workflows/:id/app     | 获取该工作流关联的 App（若有） |
| GET  | /apps/:appId           | 获取 App 信息（含当前绑定的 WorkflowVersion） |
| POST | /api/apps/:appId/run   | 以 App 身份运行（**需** `Authorization: Bearer <API_KEY>`），读 WorkflowVersion.snapshot 执行；带进程内限流（见 `APP_RUN_RATE_LIMIT_PER_MIN`） |
| GET  | /apps/:appId/embed（前端） | Web 嵌入对话页（`apps/web`）：输入框 + 对话区，调用上一行 API；可选 `?api_key=`、`?inputField=message` |
| POST | /api/apps/:appId/api-keys | **创建 ApiKey**（响应体里 **`apiKey` 明文只此一次**）；请求头 **`X-Admin-Secret`** 须与 `.env` 中 **`ADMIN_API_SECRET`** 一致 |
| GET  | /apps/:appId/api-keys  | 列出 ApiKey（暂未实现） |
| DELETE | /apps/:appId/api-keys/:keyId | 删除 ApiKey（暂未实现） |

### 5.1 如何拿到 ApiKey（推荐）

**方式 A（嵌入免填密钥）**：配置 **`ADMIN_API_SECRET`** 且 **`PUBLISH_AUTO_EMBED_API_KEY`** 不为 `false` 时，每次 **`POST /workflows/:id/publish`** 会在服务端**自动生成一把 ApiKey**，响应形如 `{"appId":"app_...","apiKey":"sk_..."}`（`apiKey` 仅此次可见）。前端发布弹层中的嵌入链接会带上 **`?api_key=`**，打开嵌入页即可对话而无需再填密钥（链接勿随意公开）。

**方式 B（手动创建）**：

1. 在 **`apps/api/.env`** 配置 **`ADMIN_API_SECRET`**（足够长的随机串），重启 API。
2. 先 **发布工作流**，记下弹层里的 **对外 `appId`**（形如 `app_xxxxxxxx`）。
3. 调用创建接口（经 Vite 代理时前缀 **`/api`**）：

```bash
curl -sS -X POST "http://localhost:3001/apps/<appId>/api-keys" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: <与 ADMIN_API_SECRET 相同>" \
  -d '{"name":"本地测试"}'
```

响应示例：`{"id":"...","name":"本地测试","apiKey":"sk_....","createdAt":"..."}`  
其中 **`apiKey` 即 Bearer 令牌**，请立即保存；库中仅存 **`sha256:` 哈希**。

### 5.2 手动入库（无 ADMIN_API_SECRET 时）

用 Prisma Studio / SQL：明文只在你本地生成；`keyHash` 为 `sha256:` + 64 位十六进制（对明文 key 做 SHA-256）。**`ApiKey.appId` 必须填 `App` 表的主键 `id`（cuid）**，不是对外字符串 `appId`。

## 6. 执行时版本

- **控制台「运行」**：用当前 Workflow.graph 执行（draft）。
- **App API / 嵌入**：用 App.workflowVersion.snapshot.graph 执行，保证发布版本不变。
