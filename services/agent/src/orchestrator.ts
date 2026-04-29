import { db } from '@pcp/db/src/client';
import {
  tasks,
  taskSteps,
  conversations,
  toolCalls,
  approvalRequests,
  workspaces,
  personas as personasTable,
  skills as skillsTable,
  userPreferences,
  auditLogs,
} from '@pcp/db/src/schema';
import { validateSessionUserId } from '@pcp/db/src/session';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { LLMProvider, Message } from './llm/types';
import { createLLMProvider } from './llm/provider';
import { resolveUserProvider } from './llm/credentials';
import { ToolRegistry, ToolContext } from './tools/registry';
import { ReadFileTool } from './tools/read_file';
import { WriteFileTool } from './tools/write_file';
import { ListFilesTool } from './tools/list_files';
import { RunCommandTool } from './tools/run_command';
import { WebSearchTool } from './tools/web_search';
import { WebFetchTool } from './tools/web_fetch';
import { SearchMemoryTool } from './tools/search_memory';
import { AddMemoryTool } from './tools/add_memory';
import { QueryDatasetTool } from './tools/query_dataset';
import {
  BrowserOpenTool,
  BrowserExtractTool,
  BrowserScreenshotTool,
  BrowserClickTool,
  BrowserFillTool,
} from './tools/browser';
import { WorkspaceClient } from './clients/workspace';
import { RuntimeClient } from './clients/runtime';
import { MemoryClient } from './clients/memory';

const TOOL_APPROVAL_TTL_MS = 15 * 60 * 1000;
const INTERRUPTED_WORK_MESSAGE =
  'Agent work was interrupted before completion and was marked failed to avoid replaying side effects.';

export class AgentOrchestrator {
  private llm: LLMProvider;
  private registry: ToolRegistry;
  private clients: { workspace: WorkspaceClient; runtime: RuntimeClient; memory: MemoryClient };
  // Per-task cached runtime ids so multiple run_command calls in one loop reuse a runtime.
  private taskRuntimeIds = new Map<string, string>();

  constructor(private logger: any) {
    this.llm = createLLMProvider();
    this.registry = new ToolRegistry();
    this.clients = {
      workspace: new WorkspaceClient(),
      runtime: new RuntimeClient(),
      memory: new MemoryClient(),
    };

    // Register default tools
    this.registry.register(new ReadFileTool());
    this.registry.register(new WriteFileTool());
    this.registry.register(new ListFilesTool());
    this.registry.register(new RunCommandTool());
    this.registry.register(new WebSearchTool());
    this.registry.register(new WebFetchTool());
    this.registry.register(new SearchMemoryTool());
    this.registry.register(new AddMemoryTool());
    this.registry.register(new QueryDatasetTool());
    this.registry.register(new BrowserOpenTool());
    this.registry.register(new BrowserExtractTool());
    this.registry.register(new BrowserScreenshotTool());
    this.registry.register(new BrowserClickTool());
    this.registry.register(new BrowserFillTool());
  }

  private buildToolContext(taskId: string, userId: string, workspaceId: string): ToolContext {
    return {
      userId,
      workspaceId,
      taskId,
      logger: this.logger,
      clients: this.clients,
      runtimeId: this.taskRuntimeIds.get(taskId),
    };
  }

  private rememberRuntimeId(taskId: string, ctx: ToolContext) {
    if (ctx.runtimeId) {
      this.taskRuntimeIds.set(taskId, ctx.runtimeId);
    }
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    return validateSessionUserId(sessionId);
  }

  async getConversations(userId: string) {
    return db.query.conversations.findMany({
      where: and(eq(conversations.userId, userId), isNull(conversations.archivedAt)),
      orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
    });
  }

  async deleteConversation(conversationId: string, userId: string) {
    const convo = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });
    if (!convo) throw new Error('Conversation not found');
    await db
      .update(conversations)
      .set({ archivedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  }

  async getMessages(conversationId: string, userId: string) {
    const convo = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });
    if (!convo) throw new Error('Conversation not found');

    // For now we map tasks and task steps to messages
    const convoTasks = await db.query.tasks.findMany({
      where: and(eq(tasks.conversationId, conversationId), eq(tasks.userId, userId)),
      orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
    });

    const messages = [];
    for (const t of convoTasks.filter((task) => task.userId === userId)) {
      messages.push({
        id: t.id,
        taskId: t.id,
        taskStatus: t.status,
        conversationId,
        role: 'user',
        content: t.input,
        createdAt: t.createdAt,
      });

      const steps = await db.query.taskSteps.findMany({
        where: eq(taskSteps.taskId, t.id),
        orderBy: (taskSteps, { asc }) => [asc(taskSteps.stepNumber)],
      });

      let content = '';
      let calls = [];

      for (const s of steps) {
        if (s.type === 'thought') {
          content += s.content + '\n';
        } else if (s.type === 'action') {
          calls.push({ name: s.toolName, args: s.toolInput });
        }
      }

      if (content || calls.length > 0 || t.status !== 'pending') {
        messages.push({
          id: t.id + '-response',
          taskId: t.id,
          taskStatus: t.status,
          conversationId,
          role: 'assistant',
          content: content || t.output || '',
          toolCalls: calls.length > 0 ? calls : undefined,
          createdAt: t.updatedAt,
        });
      }
    }

    return messages;
  }

  async createTask(
    userId: string,
    workspaceId: string,
    input: string,
    conversationId?: string,
    options?: { personaId?: string | null; skillIds?: string[] },
  ) {
    await this.assertWorkspaceOwned(workspaceId, userId);

    let cid = conversationId;
    if (cid) {
      const convo = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, cid), eq(conversations.userId, userId)),
      });

      if (!convo) {
        throw new Error('Conversation not found');
      }

      if (convo.workspaceId && convo.workspaceId !== workspaceId) {
        throw new Error('Conversation workspace mismatch');
      }
    } else {
      const [convo] = await db
        .insert(conversations)
        .values({
          userId,
          workspaceId,
          title: input.substring(0, 50),
        })
        .returning();
      if (!convo) throw new Error('Failed to create conversation');
      cid = convo.id;
    }

    const [task] = await db
      .insert(tasks)
      .values({
        userId,
        workspaceId,
        conversationId: cid,
        input,
        status: 'pending',
        metadata: {
          personaId: options?.personaId ?? null,
          skillIds: options?.skillIds ?? [],
        },
      })
      .returning();

    if (!task) throw new Error('Failed to create task');

    // Fire & forget agent loop start
    this.runAgentLoop(task.id, userId).catch((err) => {
      this.logger.error({ err, taskId: task.id }, 'Agent loop failed');
      db.update(tasks)
        .set({ status: 'failed', output: err.message })
        .where(eq(tasks.id, task.id))
        .execute();
    });

    return task;
  }

  private async assertWorkspaceOwned(workspaceId: string, userId: string) {
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }
  }

  async getTask(taskId: string, userId: string) {
    return db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
    });
  }

  async getTaskSteps(taskId: string, userId: string) {
    const task = await this.getTask(taskId, userId);
    if (!task) throw new Error('Task not found');

    return db.query.taskSteps.findMany({
      where: eq(taskSteps.taskId, taskId),
      orderBy: (taskSteps, { asc }) => [asc(taskSteps.stepNumber)],
    });
  }

  async cancelTask(taskId: string, userId: string) {
    const task = await this.getTask(taskId, userId);
    if (!task) throw new Error('Task not found');
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new Error(`Task already in final state: ${task.status}`);
    }

    await db.update(tasks).set({ status: 'cancelled' }).where(eq(tasks.id, taskId));
    return { success: true };
  }

  async recoverInterruptedWork() {
    const interruptedTasks = await db.query.tasks.findMany({
      where: eq(tasks.status, 'executing'),
    });
    for (const task of interruptedTasks) {
      await db
        .update(tasks)
        .set({ status: 'failed', output: INTERRUPTED_WORK_MESSAGE, updatedAt: new Date() })
        .where(and(eq(tasks.id, task.id), eq(tasks.userId, task.userId)));
      await emitAudit(task.userId, 'AGENT_TASK_RECOVERED_FAILED', {
        taskId: task.id,
        previousStatus: 'executing',
      });
    }

    const runningToolCalls = await db.query.toolCalls.findMany({
      where: eq(toolCalls.status, 'running'),
    });
    for (const call of runningToolCalls) {
      await db
        .update(toolCalls)
        .set({
          status: 'failed',
          error: INTERRUPTED_WORK_MESSAGE,
          completedAt: new Date(),
        })
        .where(and(eq(toolCalls.id, call.id), eq(toolCalls.userId, call.userId)));
      await emitAudit(call.userId, 'TOOL_CALL_RECOVERED_FAILED', {
        taskId: call.taskId,
        toolCallId: call.id,
      });
    }
  }

  async chat(input: string, userId?: string) {
    const userProvider = userId ? await resolveUserProvider(userId).catch(() => null) : null;
    const llm: LLMProvider = userProvider?.provider ?? this.llm;
    return llm.generate([
      {
        role: 'system',
        content:
          'You are the AI operator inside a personal cloud workspace. Be concise, practical, and explain concrete next steps.',
      },
      { role: 'user', content: input },
    ]);
  }

  private async buildSystemPrompt(
    userId: string,
    base: string,
    metadata: unknown,
  ): Promise<string> {
    const meta = (
      metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
    ) as {
      personaId?: string | null;
      skillIds?: string[];
    };
    const sections: string[] = [base];

    let personaId = meta.personaId ?? null;
    if (!personaId) {
      const def = await db.query.personas.findFirst({
        where: and(eq(personasTable.userId, userId), eq(personasTable.isDefault, true)),
      });
      if (def) personaId = def.id;
    }
    if (personaId) {
      const persona = await db.query.personas.findFirst({
        where: and(eq(personasTable.id, personaId), eq(personasTable.userId, userId)),
      });
      if (persona?.systemPrompt) {
        sections.push(`# Persona: ${persona.name}\n${persona.systemPrompt}`);
      }
    }

    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (prefs?.rules && prefs.rules.trim().length > 0) {
      sections.push(
        `# User Rules\nThe user has set the following rules. Always honor them.\n${prefs.rules.trim()}`,
      );
    }

    const skillIds = Array.isArray(meta.skillIds) ? meta.skillIds.filter(Boolean) : [];
    if (skillIds.length > 0) {
      const rows = await db.query.skills.findMany({
        where: and(
          inArray(skillsTable.id, skillIds),
          eq(skillsTable.userId, userId),
          eq(skillsTable.enabled, true),
          isNull(skillsTable.deletedAt),
        ),
      });
      for (const skill of rows) {
        if (skill.bodyMarkdown && skill.bodyMarkdown.trim().length > 0) {
          sections.push(`# Skill: ${skill.name}\n${skill.bodyMarkdown.trim()}`);
        }
      }
    }

    return sections.join('\n\n');
  }

  private async runAgentLoop(taskId: string, userId: string) {
    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
    });
    if (!task || task.status !== 'pending') return;

    await db
      .update(tasks)
      .set({ status: 'executing' })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    const systemPrompt = await this.buildSystemPrompt(
      userId,
      'You are a helpful coding assistant. Use the provided tools to accomplish the task. Return the final answer when done.',
      task.metadata,
    );

    let messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      { role: 'user', content: task.input },
    ];

    // Prefer the user's saved provider credential when available; otherwise
    // fall back to the service-wide default created in the constructor.
    const userProvider = await resolveUserProvider(userId).catch((err) => {
      this.logger?.warn?.({ err, userId }, 'resolveUserProvider failed; using default LLM');
      return null;
    });
    const llm: LLMProvider = userProvider?.provider ?? this.llm;

    let stepNumber = 1;
    const maxIterations = 15;
    const tools = this.registry.getAllDefinitions();

    for (let i = 0; i < maxIterations; i++) {
      // Check if cancelled — always re-check with userId scope to prevent cross-tenant reads.
      const currentTask = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
      });
      if (!currentTask || currentTask.status === 'cancelled') return;

      const response = await llm.generate(messages, tools);

      if (response.content) {
        messages.push({ role: 'assistant', content: response.content });
        await db.insert(taskSteps).values({
          taskId,
          stepNumber: stepNumber++,
          type: 'thought',
          content: response.content,
        });
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Just handle first tool call for simplicity
        const toolCall = response.toolCalls[0];
        if (!toolCall) continue;

        const tool = this.registry.get(toolCall.name);
        const requiresApproval = tool?.requiresApproval ?? false;
        const toolArgs = parseToolArguments(toolCall.arguments);

        const [recordedToolCall] = await db
          .insert(toolCalls)
          .values({
            taskId,
            userId,
            providerCallId: toolCall.id,
            toolName: toolCall.name,
            args: toolArgs,
            status: requiresApproval ? 'awaiting_approval' : 'running',
          })
          .returning();
        if (!recordedToolCall) throw new Error('Failed to record tool call');

        await db.insert(taskSteps).values({
          taskId,
          stepNumber: stepNumber++,
          type: 'action',
          toolName: toolCall.name,
          toolInput: toolArgs,
        });

        if (requiresApproval) {
          const approval = await this.createApprovalRequest(
            userId,
            taskId,
            recordedToolCall.id,
            toolCall.name,
            toolArgs,
          );
          await db
            .update(toolCalls)
            .set({ approvalId: approval.id })
            .where(and(eq(toolCalls.id, recordedToolCall.id), eq(toolCalls.userId, userId)));
          await emitAudit(userId, 'TOOL_APPROVAL_REQUESTED', {
            taskId,
            toolCallId: recordedToolCall.id,
            approvalId: approval.id,
            tool: toolCall.name,
          });
          await db
            .update(tasks)
            .set({ status: 'waiting_approval', updatedAt: new Date() })
            .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
          return; // Pause execution
        }

        // Add assistant's tool call message
        messages.push({
          role: 'assistant',
          content: `Calling tool ${toolCall.name}`,
        });

        let toolOutputStr = '';
        const ctx = this.buildToolContext(taskId, userId, task.workspaceId);
        const startedAt = Date.now();
        try {
          const output = await this.registry.execute(toolCall.name, toolCall.arguments, ctx);
          toolOutputStr = typeof output === 'string' ? output : JSON.stringify(output);
          this.rememberRuntimeId(taskId, ctx);
          await this.completeToolCall(recordedToolCall.id, userId, 'completed', {
            result: toolOutputStr,
            durationMs: String(Date.now() - startedAt),
          });
          await emitAudit(userId, 'TOOL_EXECUTE', {
            tool: toolCall.name,
            taskId,
            ok: true,
          });
        } catch (error: any) {
          toolOutputStr = `Error executing tool: ${error.message}`;
          await this.completeToolCall(recordedToolCall.id, userId, 'failed', {
            error: error?.message,
            durationMs: String(Date.now() - startedAt),
          });
          await emitAudit(userId, 'TOOL_EXECUTE', {
            tool: toolCall.name,
            taskId,
            ok: false,
            error: error?.message,
          });
        }

        await db.insert(taskSteps).values({
          taskId,
          stepNumber: stepNumber++,
          type: 'observation',
          toolOutput: toolOutputStr,
        });

        messages.push({
          role: 'user', // Observation
          content: toolOutputStr,
          name: toolCall.name,
        });
      } else {
        // No tool calls means the agent is done
        await db
          .update(tasks)
          .set({
            status: 'completed',
            output: response.content,
          })
          .where(eq(tasks.id, taskId));
        this.taskRuntimeIds.delete(taskId);
        await this.persistTaskMemory(userId, task.workspaceId, task.input, response.content ?? '');
        return;
      }
    }

    // Exceeded max iterations
    await db
      .update(tasks)
      .set({
        status: 'failed',
        output: 'Exceeded maximum iterations without completing the task.',
      })
      .where(eq(tasks.id, taskId));
    this.taskRuntimeIds.delete(taskId);
  }

  /**
   * Best-effort: persist a one-line summary of a completed task into long-term memory
   * so future tasks can recall what was done.
   */
  private async persistTaskMemory(
    userId: string,
    workspaceId: string,
    input: string,
    output: string,
  ) {
    if (!output) return;
    try {
      const summary = `Task: ${input.slice(0, 200)}\nOutcome: ${output.slice(0, 600)}`;
      await this.clients.memory.add(userId, 'task_summary', summary, { workspaceId });
    } catch (err) {
      this.logger.warn({ err }, 'Failed to persist task memory');
    }
  }

  async submitToolApproval(
    taskId: string,
    userId: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ) {
    const task = await this.getTask(taskId, userId);
    if (!task || task.status !== 'waiting_approval')
      throw new Error('Task not waiting for approval');

    const pendingCall = await db.query.toolCalls.findFirst({
      where: and(
        eq(toolCalls.taskId, taskId),
        eq(toolCalls.userId, userId),
        eq(toolCalls.status, 'awaiting_approval'),
      ),
    });

    if (!pendingCall) throw new Error('No pending tool calls');

    const approval = await db.query.approvalRequests.findFirst({
      where: and(
        eq(approvalRequests.toolCallId, pendingCall.id),
        eq(approvalRequests.taskId, taskId),
        eq(approvalRequests.userId, userId),
      ),
    });
    if (!approval) throw new Error('No pending approval request');

    if (approval.expiresAt.getTime() <= Date.now()) {
      await this.expireApproval(userId, taskId, pendingCall.id, approval.id);
      throw new Error('Tool approval expired');
    }

    await db
      .update(approvalRequests)
      .set({
        decision,
        decisionReason: reason ?? null,
        decidedAt: new Date(),
      })
      .where(and(eq(approvalRequests.id, approval.id), eq(approvalRequests.userId, userId)));
    await emitAudit(userId, 'TOOL_APPROVAL_DECIDED', {
      taskId,
      toolCallId: pendingCall.id,
      approvalId: approval.id,
      tool: pendingCall.toolName,
      decision,
    });

    if (decision === 'reject') {
      await this.completeToolCall(pendingCall.id, userId, 'rejected', {
        error: reason ?? 'Rejected by user',
      });
      await db.insert(taskSteps).values({
        taskId,
        stepNumber: 999,
        type: 'observation',
        toolOutput: `User rejected tool execution: ${reason || 'No reason provided'}`,
      });
      await db
        .update(tasks)
        .set({ status: 'executing', updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      // Resume
      this.runAgentLoop(taskId, userId).catch(console.error);
    } else {
      // Execute tool and resume
      const ctx = this.buildToolContext(taskId, userId, task.workspaceId);
      const startedAt = Date.now();
      await db
        .update(toolCalls)
        .set({ status: 'running' })
        .where(and(eq(toolCalls.id, pendingCall.id), eq(toolCalls.userId, userId)));
      try {
        const output = await this.registry.executeApproved(
          pendingCall.toolName,
          JSON.stringify(pendingCall.args),
          ctx,
        );
        const toolOutput = typeof output === 'string' ? output : JSON.stringify(output);
        this.rememberRuntimeId(taskId, ctx);
        await db.insert(taskSteps).values({
          taskId,
          stepNumber: 999,
          type: 'observation',
          toolOutput,
        });
        await this.completeToolCall(pendingCall.id, userId, 'completed', {
          result: toolOutput,
          durationMs: String(Date.now() - startedAt),
        });
        await emitAudit(userId, 'TOOL_EXECUTE_APPROVED', {
          tool: pendingCall.toolName,
          taskId,
          ok: true,
        });
      } catch (err: any) {
        await db.insert(taskSteps).values({
          taskId,
          stepNumber: 999,
          type: 'observation',
          toolOutput: `Error executing tool: ${err.message}`,
        });
        await this.completeToolCall(pendingCall.id, userId, 'failed', {
          error: err?.message,
          durationMs: String(Date.now() - startedAt),
        });
        await emitAudit(userId, 'TOOL_EXECUTE_APPROVED', {
          tool: pendingCall.toolName,
          taskId,
          ok: false,
          error: err?.message,
        });
      }
      await db
        .update(tasks)
        .set({ status: 'executing', updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      // Resume
      this.runAgentLoop(taskId, userId).catch(console.error);
    }
  }

  private async createApprovalRequest(
    userId: string,
    taskId: string,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const [approval] = await db
      .insert(approvalRequests)
      .values({
        userId,
        taskId,
        toolCallId,
        toolName,
        args,
        riskNote: `${toolName} requires explicit user approval before execution.`,
        decision: null,
        expiresAt: new Date(Date.now() + TOOL_APPROVAL_TTL_MS),
      })
      .returning();
    if (!approval) throw new Error('Failed to create approval request');
    return approval;
  }

  private async expireApproval(
    userId: string,
    taskId: string,
    toolCallId: string,
    approvalId: string,
  ): Promise<void> {
    await db
      .update(approvalRequests)
      .set({ decision: 'expired', decidedAt: new Date() })
      .where(and(eq(approvalRequests.id, approvalId), eq(approvalRequests.userId, userId)));
    await db
      .update(toolCalls)
      .set({
        status: 'timeout',
        error: 'Tool approval expired before the user approved execution',
        completedAt: new Date(),
      })
      .where(and(eq(toolCalls.id, toolCallId), eq(toolCalls.userId, userId)));
    await db
      .update(tasks)
      .set({
        status: 'failed',
        output: 'Tool approval expired before execution.',
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    await emitAudit(userId, 'TOOL_APPROVAL_EXPIRED', {
      taskId,
      toolCallId,
      approvalId,
    });
  }

  private async completeToolCall(
    toolCallId: string,
    userId: string,
    status: 'completed' | 'failed' | 'rejected',
    result: { result?: string; error?: string; durationMs?: string },
  ): Promise<void> {
    await db
      .update(toolCalls)
      .set({
        status,
        result: result.result,
        error: result.error,
        durationMs: result.durationMs,
        completedAt: new Date(),
      })
      .where(and(eq(toolCalls.id, toolCallId), eq(toolCalls.userId, userId)));
  }
}

function parseToolArguments(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

async function emitAudit(
  userId: string | null,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ userId, action, details });
  } catch (e) {
    // Audit failures must not block the main flow.
    console.error('audit_log emit failed', { action, error: (e as Error).message });
  }
}
