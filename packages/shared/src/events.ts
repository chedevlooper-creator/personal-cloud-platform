/**
 * Event bus abstraction for loosely-coupled cross-service communication.
 */

export interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void | Promise<void>,
  ): Promise<void>;
}

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}

export interface TaskCompletedEvent extends DomainEvent {
  type: 'TaskCompleted';
  payload: {
    taskId: string;
    userId: string;
    workspaceId: string;
    output: string;
  };
}

export interface WorkspaceCreatedEvent extends DomainEvent {
  type: 'WorkspaceCreated';
  payload: {
    workspaceId: string;
    userId: string;
    name: string;
  };
}

export interface AutomationRunFinishedEvent extends DomainEvent {
  type: 'AutomationRunFinished';
  payload: {
    automationId: string;
    userId: string;
    success: boolean;
    output?: string;
    error?: string;
  };
}

export interface UserCreatedEvent extends DomainEvent {
  type: 'UserCreated';
  payload: {
    userId: string;
    email: string;
    name: string | null;
  };
}

export type KnownEvent =
  | TaskCompletedEvent
  | WorkspaceCreatedEvent
  | AutomationRunFinishedEvent
  | UserCreatedEvent;
