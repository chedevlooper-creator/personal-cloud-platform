import { db } from '@pcp/db/src/client';
import { tasks, taskSteps, users, sessions, conversations, toolCalls } from '@pcp/db/src/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { LLMProvider, Message } from './llm/types';
import { createLLMProvider } from './llm/provider';
import { ToolRegistry } from './tools/registry';
import { ReadFileTool } from './tools/read_file';
import { WriteFileTool } from './tools/write_file';
import { ListFilesTool } from './tools/list_files';
import { RunCommandTool } from './tools/run_command';

export class AgentOrchestrator {
  private llm: LLMProvider;
  private registry: ToolRegistry;

  constructor(private logger: any) {
    this.llm = createLLMProvider();
    this.registry = new ToolRegistry();
    
    // Register default tools
    this.registry.register(new ReadFileTool());
    this.registry.register(new WriteFileTool());
    this.registry.register(new ListFilesTool());
    this.registry.register(new RunCommandTool());
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    return user?.id || null;
  }

  async getConversations(userId: string) {
    return db.query.conversations.findMany({
      where: and(eq(conversations.userId, userId), isNull(conversations.archivedAt)),
      orderBy: (conversations, { desc }) => [desc(conversations.createdAt)],
    });
  }

  async getMessages(conversationId: string, userId: string) {
    const convo = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });
    if (!convo) throw new Error('Conversation not found');

    // For now we map tasks and task steps to messages
    const convoTasks = await db.query.tasks.findMany({
      where: eq(tasks.conversationId, conversationId),
      orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
    });

    const messages = [];
    for (const t of convoTasks) {
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

  async createTask(userId: string, workspaceId: string, input: string, conversationId?: string) {
    let cid = conversationId;
    if (!cid) {
      const [convo] = await db.insert(conversations).values({
        userId,
        workspaceId,
        title: input.substring(0, 50),
      }).returning();
      if (!convo) throw new Error('Failed to create conversation');
      cid = convo.id;
    }

    const [task] = await db.insert(tasks).values({
      userId,
      workspaceId,
      conversationId: cid,
      input,
      status: 'pending',
    }).returning();

    if (!task) throw new Error('Failed to create task');

    // Fire & forget agent loop start
    this.runAgentLoop(task.id, userId).catch(err => {
      this.logger.error({ err, taskId: task.id }, 'Agent loop failed');
      db.update(tasks).set({ status: 'failed', output: err.message }).where(eq(tasks.id, task.id)).execute();
    });

    return task;
  }

  async getTask(taskId: string, userId: string) {
    return db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, userId))
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

  async chat(input: string) {
    return this.llm.generate([
      {
        role: 'system',
        content:
          'You are the AI operator inside a personal cloud workspace. Be concise, practical, and explain concrete next steps.',
      },
      { role: 'user', content: input },
    ]);
  }

  private async runAgentLoop(taskId: string, userId: string) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task || task.status !== 'pending') return;

    await db.update(tasks).set({ status: 'executing' }).where(eq(tasks.id, taskId));

    let messages: Message[] = [
      { role: 'system', content: 'You are a helpful coding assistant. Use the provided tools to accomplish the task. Return the final answer when done.' },
      { role: 'user', content: task.input }
    ];

    let stepNumber = 1;
    const maxIterations = 15;
    const tools = this.registry.getAllDefinitions();

    for (let i = 0; i < maxIterations; i++) {
      // Check if cancelled
      const currentTask = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
      if (currentTask?.status === 'cancelled') return;

      const response = await this.llm.generate(messages, tools);

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
        
        // Note: For a real approval flow, we'd check if tool requires approval
        // Since we don't have requiresApproval in schema yet, let's hardcode 'run_command' for instance
        const requiresApproval = toolCall.name === 'run_command';

        await db.insert(toolCalls).values({
          taskId,
          userId,
          toolName: toolCall.name,
          args: JSON.parse(toolCall.arguments),
          status: requiresApproval ? 'awaiting_approval' : 'running',
        }).execute();

        await db.insert(taskSteps).values({
          taskId,
          stepNumber: stepNumber++,
          type: 'action',
          toolName: toolCall.name,
          toolInput: JSON.parse(toolCall.arguments),
        });

        if (requiresApproval) {
          await db.update(tasks).set({ status: 'waiting_approval' }).where(eq(tasks.id, taskId));
          return; // Pause execution
        }

        // Add assistant's tool call message
        messages.push({
          role: 'assistant',
          content: `Calling tool ${toolCall.name}`,
        });

        let toolOutputStr = '';
        try {
          const output = await this.registry.execute(toolCall.name, toolCall.arguments, {
            userId,
            workspaceId: task.workspaceId,
            taskId,
          });
          toolOutputStr = typeof output === 'string' ? output : JSON.stringify(output);
        } catch (error: any) {
          toolOutputStr = `Error executing tool: ${error.message}`;
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
        await db.update(tasks).set({ 
          status: 'completed',
          output: response.content 
        }).where(eq(tasks.id, taskId));
        return;
      }
    }

    // Exceeded max iterations
    await db.update(tasks).set({ 
      status: 'failed',
      output: 'Exceeded maximum iterations without completing the task.' 
    }).where(eq(tasks.id, taskId));
  }

  async submitToolApproval(taskId: string, userId: string, decision: 'approve' | 'reject', reason?: string) {
    const task = await this.getTask(taskId, userId);
    if (!task || task.status !== 'waiting_approval') throw new Error('Task not waiting for approval');

    const pendingCall = await db.query.toolCalls.findFirst({
      where: and(eq(toolCalls.taskId, taskId), eq(toolCalls.status, 'awaiting_approval')),
    });

    if (!pendingCall) throw new Error('No pending tool calls');

    await db.update(toolCalls).set({
      status: decision === 'approve' ? 'running' : 'rejected',
      error: decision === 'reject' ? reason : null,
    }).where(eq(toolCalls.id, pendingCall.id));

    if (decision === 'reject') {
       await db.insert(taskSteps).values({
          taskId,
          stepNumber: 999,
          type: 'observation',
          toolOutput: `User rejected tool execution: ${reason || 'No reason provided'}`,
       });
       await db.update(tasks).set({ status: 'executing' }).where(eq(tasks.id, taskId));
       // Resume
       this.runAgentLoop(taskId, userId).catch(console.error);
    } else {
       // Execute tool and resume
       try {
         const output = await this.registry.execute(pendingCall.toolName, JSON.stringify(pendingCall.args), {
           userId,
           workspaceId: task.workspaceId,
           taskId,
         });
         await db.insert(taskSteps).values({
            taskId,
            stepNumber: 999,
            type: 'observation',
            toolOutput: typeof output === 'string' ? output : JSON.stringify(output),
         });
       } catch(err: any) {
         await db.insert(taskSteps).values({
            taskId,
            stepNumber: 999,
            type: 'observation',
            toolOutput: `Error executing tool: ${err.message}`,
         });
       }
       await db.update(toolCalls).set({ status: 'completed' }).where(eq(toolCalls.id, pendingCall.id));
       await db.update(tasks).set({ status: 'executing' }).where(eq(tasks.id, taskId));
       // Resume
       this.runAgentLoop(taskId, userId).catch(console.error);
    }
  }
}
