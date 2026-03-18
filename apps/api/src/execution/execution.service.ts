import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

interface WorkflowGraph {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
}

interface AINodeData {
  provider?: 'openai' | 'bailian' | 'local';
  model?: string;
  systemPrompt?: string;
  inputMapping?: Record<string, string>;
}

interface InputNodeData {
  assignments?: Record<string, unknown>;
}

interface OutputNodeData {
  outputMapping?: Record<string, unknown>;
}

interface HttpNodeData {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface ConditionIfData {
  expression?: string;
  trueOutput?: string;
  falseOutput?: string;
}

interface ConditionSwitchData {
  variable?: string;
  cases?: Array<{ value: string; outputKey: string }>;
  defaultOutput?: string;
}

interface NodeLogEntry {
  nodeId: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'success' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * 同步执行引擎：按 DAG 拓扑执行，支持 start/trigger/plain/end 透传与 ai 节点调用 LLM。
 * AI 节点带可配置重试与 backoff；nodeLogs 落库。
 */
@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async startRun(workflowId: string, inputs: Record<string, unknown> = {}) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    const graph = workflow.graph as unknown as WorkflowGraph;
    const run = await this.prisma.runRecord.create({
      data: {
        workflowId,
        workflowVersion: workflow.version,
        status: 'running',
        inputs: inputs as object,
        startedAt: new Date(),
      },
    });

    const nodeLogs: NodeLogEntry[] = [];
    try {
      const { nodeOutputs, explicitOutputs } = await this.executeGraph(graph, inputs, nodeLogs);
      const outputs =
        explicitOutputs && Object.keys(explicitOutputs).length > 0
          ? explicitOutputs
          : this.collectOutputs(graph, nodeOutputs);
      const logsForDb = nodeLogs.map((l) => ({
        nodeId: l.nodeId,
        startedAt: l.startedAt.toISOString(),
        finishedAt: l.finishedAt?.toISOString(),
        status: l.status,
        input: l.input as object | undefined,
        output: l.output as object | undefined,
        error: l.error,
      }));
      await this.prisma.runRecord.update({
        where: { id: run.id },
        data: {
          status: 'success',
          outputs: outputs as object,
          nodeLogs: logsForDb as object,
          finishedAt: new Date(),
        },
      });
      return {
        runId: run.id,
        status: 'success' as const,
        outputs,
        nodeLogs: logsForDb,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const logsForDb = nodeLogs.map((l) => ({
        nodeId: l.nodeId,
        startedAt: l.startedAt.toISOString(),
        finishedAt: l.finishedAt?.toISOString(),
        status: l.status,
        input: l.input as object | undefined,
        output: l.output as object | undefined,
        error: l.error,
      }));
      await this.prisma.runRecord.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: message,
          nodeLogs: logsForDb as object,
          finishedAt: new Date(),
        },
      });
      throw err;
    }
  }

  private async executeGraph(
    graph: WorkflowGraph,
    initialInputs: Record<string, unknown>,
    nodeLogs: NodeLogEntry[],
  ): Promise<{
    nodeOutputs: Record<string, { output: Record<string, unknown>; error?: string }>;
    explicitOutputs: Record<string, unknown>;
  }> {
    const sorted = this.topologicalSort(graph);
    const nodeOutputs: Record<string, { output: Record<string, unknown>; error?: string }> = {};
    const context: Record<string, unknown> = { inputs: initialInputs, ...initialInputs };
    const explicitOutputs: Record<string, unknown> = {};
    const conditionChosenHandle: Record<string, string> = {};

    for (const nodeId of sorted) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const startedAt = new Date();
      const incoming = this.getIncomingData(
        graph,
        nodeId,
        nodeOutputs,
        conditionChosenHandle,
      );
      const input = { ...context, ...incoming };

      if (
        node.type !== 'start' &&
        node.type !== 'trigger' &&
        !this.isNodeReachable(graph, nodeId, nodeOutputs, conditionChosenHandle)
      ) {
        continue;
      }

      if (node.type === 'start' || node.type === 'trigger' || node.type === 'plain') {
        nodeOutputs[nodeId] = { output: input };
        Object.assign(context, input);
        nodeLogs.push({
          nodeId,
          startedAt,
          finishedAt: new Date(),
          status: 'success',
          input,
          output: input,
        });
        continue;
      }
      if (node.type === 'end') {
        nodeOutputs[nodeId] = { output: input };
        Object.assign(context, input);
        nodeLogs.push({
          nodeId,
          startedAt,
          finishedAt: new Date(),
          status: 'success',
          input,
          output: input,
        });
        continue;
      }

      if (node.type === 'input') {
        try {
          const inData = (node.data || {}) as InputNodeData;
          const assignments = (inData.assignments || {}) as Record<string, unknown>;
          const output: Record<string, unknown> = {};
          for (const [k, expr] of Object.entries(assignments)) {
            output[k] = this.resolveValue(expr, context);
          }
          nodeOutputs[nodeId] = { output: output as Record<string, unknown> };
          Object.assign(context, output);
          Object.assign(context, { [nodeId]: output });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output: output as Record<string, unknown>,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      if (node.type === 'output') {
        try {
          const outData = (node.data || {}) as OutputNodeData;
          const mapping = (outData.outputMapping || {}) as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          for (const [k, expr] of Object.entries(mapping)) {
            const v = this.resolveValue(expr, context);
            out[k] = v;
            explicitOutputs[k] = v;
          }
          nodeOutputs[nodeId] = { output: out as Record<string, unknown> };
          Object.assign(context, { [nodeId]: out });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output: out as Record<string, unknown>,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      if (node.type === 'http') {
        try {
          const httpData = (node.data || {}) as HttpNodeData;
          const method = (httpData.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE';
          const urlRaw = String(httpData.url || '');
          const url = String(this.resolveValue(urlRaw, context));
          const headersRaw = (httpData.headers || {}) as Record<string, string>;
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(headersRaw)) {
            headers[k] = String(this.resolveValue(v, context));
          }
          const bodyRaw = httpData.body;
          const body =
            bodyRaw != null && bodyRaw !== ''
              ? String(this.resolveValue(bodyRaw, context))
              : undefined;
          const res = await fetch(url, {
            method,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            body: method !== 'GET' && body ? body : undefined,
          });
          const text = await res.text();
          let output: Record<string, unknown>;
          try {
            output = { status: res.status, data: JSON.parse(text), raw: text };
          } catch {
            output = { status: res.status, data: text, raw: text };
          }
          nodeOutputs[nodeId] = { output };
          Object.assign(context, { [nodeId]: output });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      if (node.type === 'ai') {
        try {
          const aiData = (node.data || {}) as AINodeData;
          const provider = aiData.provider ?? 'openai';
          const model =
            (aiData.model as string) ||
            (provider === 'bailian' ? 'qwen3.5-plus' : 'gpt-3.5-turbo');
          const systemPrompt = aiData.systemPrompt as string | undefined;
          const inputMapping = (aiData.inputMapping || {}) as Record<string, string>;
          const userContent = String(
            this.resolveValue(
              inputMapping['user'] ?? inputMapping['content'] ?? JSON.stringify(input),
              context,
            ),
          );
          const messages = [{ role: 'user' as const, content: userContent }];
          const text = await this.aiService.complete(provider, messages, {
            model,
            systemPrompt,
            maxRetries: 2,
            retryBackoffMs: 1000,
          });
          const output = { text, content: text };
          nodeOutputs[nodeId] = { output };
          Object.assign(context, { [nodeId]: output });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      if (node.type === 'condition_if') {
        try {
          const condData = (node.data || {}) as ConditionIfData;
          const expr = String(condData.expression ?? 'false');
          const result = this.evaluateExpression(expr, context);
          const chosen = result ? 'true' : 'false';
          conditionChosenHandle[nodeId] = chosen;
          const output = { branch: chosen, result };
          nodeOutputs[nodeId] = { output };
          Object.assign(context, { [nodeId]: output });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          conditionChosenHandle[nodeId] = 'false';
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      if (node.type === 'condition_switch') {
        try {
          const switchData = (node.data || {}) as ConditionSwitchData;
          const variablePath = String(switchData.variable ?? '').trim().replace(/^\{\{|\}\}$/g, '').trim();
          const cases = (switchData.cases || []) as Array<{ value: string; outputKey: string }>;
          const defaultKey = String(switchData.defaultOutput ?? '__default__');
          const variableValue = this.getByPath(context, variablePath);
          const valueStr = variableValue != null ? String(variableValue) : '';
          let chosen = defaultKey;
          for (const c of cases) {
            if (String(c.value) === valueStr) {
              chosen = c.outputKey;
              break;
            }
          }
          conditionChosenHandle[nodeId] = chosen;
          const output = { branch: chosen, value: variableValue };
          nodeOutputs[nodeId] = { output };
          Object.assign(context, { [nodeId]: output });
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            input,
            output,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          nodeOutputs[nodeId] = { output: {}, error: errMsg };
          conditionChosenHandle[nodeId] = '__default__';
          nodeLogs.push({
            nodeId,
            startedAt,
            finishedAt: new Date(),
            status: 'failed',
            input,
            error: errMsg,
          });
          throw e;
        }
        continue;
      }

      nodeOutputs[nodeId] = { output: input };
      Object.assign(context, { [nodeId]: input });
      nodeLogs.push({
        nodeId,
        startedAt,
        finishedAt: new Date(),
        status: 'success',
        input,
        output: input,
      });
    }
    return { nodeOutputs, explicitOutputs };
  }

  private evaluateExpression(expr: string, context: Record<string, unknown>): boolean {
    const replaced = expr.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const v = this.getByPath(context, path.trim());
      if (v === true || v === false) return String(v);
      if (v == null) return 'null';
      if (typeof v === 'number') return String(v);
      return JSON.stringify(String(v));
    });
    try {
      const fn = new Function('return !!(' + replaced + ')');
      return fn();
    } catch {
      return false;
    }
  }

  private getByPath(context: Record<string, unknown>, path: string): unknown {
    const keys = path.trim().split('.').filter(Boolean);
    let v: unknown = context;
    for (const k of keys) {
      if (v == null || typeof v !== 'object') return undefined;
      v = (v as Record<string, unknown>)[k];
    }
    return v;
  }

  /**
   * 支持两种形式：
   * - 若 expr 为字符串且完全等于 "{{path}}": 返回 path 对应的真实值（可为非字符串）
   * - 其它字符串：做模板替换，返回字符串
   * - 非字符串：原样返回
   */
  private resolveValue(expr: unknown, context: Record<string, unknown>): unknown {
    if (typeof expr !== 'string') return expr;
    const trimmed = expr.trim();
    const exact = trimmed.match(/^\{\{([^}]+)\}\}$/);
    if (exact) return this.getByPath(context, exact[1]);
    return expr.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const v = this.getByPath(context, path);
      return v != null ? String(v) : '';
    });
  }

  private topologicalSort(graph: WorkflowGraph): string[] {
    const inDegree: Record<string, number> = {};
    graph.nodes.forEach((n) => (inDegree[n.id] = 0));
    graph.edges.forEach((e) => (inDegree[e.target] = (inDegree[e.target] ?? 0) + 1));
    const queue = graph.nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const result: string[] = [];
    while (queue.length) {
      const u = queue.shift()!;
      result.push(u);
      graph.edges
        .filter((e) => e.source === u)
        .forEach((e) => {
          inDegree[e.target]--;
          if (inDegree[e.target] === 0) queue.push(e.target);
        });
    }
    return result;
  }

  private isNodeReachable(
    graph: WorkflowGraph,
    nodeId: string,
    nodeOutputs: Record<string, { output: Record<string, unknown> }>,
    conditionChosenHandle: Record<string, string>,
  ): boolean {
    const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
    if (incomingEdges.length === 0) return true;
    for (const e of incomingEdges) {
      const srcNode = graph.nodes.find((n) => n.id === e.source);
      if (!nodeOutputs[e.source]) continue;
      if (!srcNode || (srcNode.type !== 'condition_if' && srcNode.type !== 'condition_switch')) {
        return true;
      }
      const chosen = conditionChosenHandle[e.source];
      if (!chosen) continue;
      const handle = e.sourceHandle ?? 'out';
      if (handle === chosen) return true;
    }
    return false;
  }

  private getIncomingData(
    graph: WorkflowGraph,
    nodeId: string,
    nodeOutputs: Record<string, { output: Record<string, unknown> }>,
    conditionChosenHandle?: Record<string, string>,
  ): Record<string, unknown> {
    const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
    const merged: Record<string, unknown> = {};
    incomingEdges.forEach((e) => {
      const srcNode = graph.nodes.find((n) => n.id === e.source);
      if (conditionChosenHandle && srcNode) {
        if (srcNode.type === 'condition_if' || srcNode.type === 'condition_switch') {
          const chosen = conditionChosenHandle[e.source];
          const handle = e.sourceHandle ?? 'out';
          if (chosen !== handle) return;
        }
      }
      const out = nodeOutputs[e.source]?.output;
      if (out) Object.assign(merged, out);
    });
    return merged;
  }

  private collectOutputs(
    graph: WorkflowGraph,
    nodeOutputs: Record<string, { output: Record<string, unknown> }>,
  ): Record<string, unknown> {
    const endNodes = graph.nodes.filter((n) => n.type === 'end' || n.type === 'plain');
    if (endNodes.length === 0) {
      const last = graph.nodes[graph.nodes.length - 1];
      return last ? (nodeOutputs[last.id]?.output ?? {}) : {};
    }
    const merged: Record<string, unknown> = {};
    endNodes.forEach((n) => {
      const out = nodeOutputs[n.id]?.output;
      if (out) Object.assign(merged, out);
    });
    return merged;
  }

  async getRun(runId: string) {
    const run = await this.prisma.runRecord.findUnique({
      where: { id: runId },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async getRunsByWorkflow(workflowId: string, limit = 20) {
    return this.prisma.runRecord.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
