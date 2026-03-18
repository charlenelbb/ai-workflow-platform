import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

interface WorkflowGraph {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

interface AINodeData {
  provider?: 'openai' | 'bailian' | 'local';
  model?: string;
  systemPrompt?: string;
  inputMapping?: Record<string, string>;
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
      const nodeOutputs = await this.executeGraph(graph, inputs, nodeLogs);
      const outputs = this.collectOutputs(graph, nodeOutputs);
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
  ): Promise<Record<string, { output: Record<string, unknown>; error?: string }>> {
    const sorted = this.topologicalSort(graph);
    const nodeOutputs: Record<string, { output: Record<string, unknown>; error?: string }> = {};
    const context: Record<string, unknown> = { ...initialInputs };

    for (const nodeId of sorted) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const startedAt = new Date();
      const incoming = this.getIncomingData(graph, nodeId, nodeOutputs);
      const input = { ...context, ...incoming };

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

      if (node.type === 'ai') {
        try {
          const aiData = (node.data || {}) as AINodeData;
          const provider = aiData.provider ?? 'openai';
          const model = (aiData.model as string) || 'gpt-3.5-turbo';
          const systemPrompt = aiData.systemPrompt as string | undefined;
          const inputMapping = (aiData.inputMapping || {}) as Record<string, string>;
          const userContent = this.resolveTemplate(
            inputMapping['user'] ?? inputMapping['content'] ?? JSON.stringify(input),
            context,
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
    return nodeOutputs;
  }

  /** 将 {{key}} 或 {{key.sub}} 替换为 context 中的值 */
  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const keys = path.trim().split('.');
      let v: unknown = context;
      for (const k of keys) {
        if (v == null || typeof v !== 'object') return '';
        v = (v as Record<string, unknown>)[k];
      }
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

  private getIncomingData(
    graph: WorkflowGraph,
    nodeId: string,
    nodeOutputs: Record<string, { output: Record<string, unknown> }>,
  ): Record<string, unknown> {
    const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
    const merged: Record<string, unknown> = {};
    incomingEdges.forEach((e) => {
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
