import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface WorkflowGraph {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

/**
 * MVP 同步执行引擎：按 DAG 拓扑执行，仅做数据透传。
 * 后续可在此扩展：AI 节点调用、HTTP 节点、条件节点、重试队列等。
 */
@Injectable()
export class ExecutionService {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(workflowId: string, inputs: Record<string, unknown> = {}) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    const graph = workflow.graph as WorkflowGraph;
    const run = await this.prisma.runRecord.create({
      data: {
        workflowId,
        workflowVersion: workflow.version,
        status: 'running',
        inputs: inputs as object,
        startedAt: new Date(),
      },
    });

    try {
      const nodeOutputs = await this.executeGraph(graph, inputs);
      const outputs = this.collectOutputs(graph, nodeOutputs);
      await this.prisma.runRecord.update({
        where: { id: run.id },
        data: {
          status: 'success',
          outputs: outputs as object,
          finishedAt: new Date(),
        },
      });
      return {
        runId: run.id,
        status: 'success' as const,
        outputs,
        nodeLogs: nodeOutputs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.runRecord.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: message,
          finishedAt: new Date(),
        },
      });
      throw err;
    }
  }

  private async executeGraph(
    graph: WorkflowGraph,
    initialInputs: Record<string, unknown>,
  ): Promise<Record<string, { output: Record<string, unknown>; error?: string }>> {
    const sorted = this.topologicalSort(graph);
    const nodeOutputs: Record<string, { output: Record<string, unknown>; error?: string }> = {};
    const context: Record<string, unknown> = { ...initialInputs };

    for (const nodeId of sorted) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const incoming = this.getIncomingData(graph, nodeId, nodeOutputs);
      const input = { ...context, ...incoming };

      if (node.type === 'start' || node.type === 'trigger' || node.type === 'plain') {
        nodeOutputs[nodeId] = { output: input };
        Object.assign(context, input);
        continue;
      }
      if (node.type === 'end') {
        nodeOutputs[nodeId] = { output: input };
        Object.assign(context, input);
        continue;
      }

      nodeOutputs[nodeId] = { output: input };
      Object.assign(context, { [nodeId]: input });
    }
    return nodeOutputs;
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
