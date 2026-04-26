import { db } from '@pcp/db/src/client';
import { tasks, taskSteps, users, sessions } from '@pcp/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { LLMProvider, Message } from './llm/types';
import { OpenAIProvider } from './llm/openai';
import { ToolRegistry } from './tools/registry';
import { ReadFileTool } from './tools/read_file';

export class AgentOrchestrator {
  private llm: LLMProvider;
  private registry: ToolRegistry;

  constructor(private logger: any) {
    this.llm = new OpenAIProvider(process.env.OPENAI_API_KEY || 'dummy_key');
    this.registry = new ToolRegistry();
    
    // Register default tools
    this.registry.register(new ReadFileTool());
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

  async createTask(userId: string, workspaceId: string, input: string) {
    const [task] = await db.insert(tasks).values({
      userId,
      workspaceId,
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
        
        await db.insert(taskSteps).values({
          taskId,
          stepNumber: stepNumber++,
          type: 'action',
          toolName: toolCall.name,
          toolInput: JSON.parse(toolCall.arguments),
        });

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
}
