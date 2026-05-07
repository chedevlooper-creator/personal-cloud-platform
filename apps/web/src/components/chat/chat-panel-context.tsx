'use client';

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import type React from 'react';

export type ChatPanelState = {
  isOpen: boolean;
  width: number;
  activeConversationId: string | null;
  activeWorkspaceId: string | null;
};

export type FileAttachment = {
  path: string;
  name: string;
  size?: number;
  type?: string;
  preview?: string;
  uploading?: boolean;
  uploadProgress?: number;
};

export type ChatPanelContextType = {
  isOpen: boolean;
  width: number;
  activeConversationId: string | null;
  activeWorkspaceId: string | null;
  attachments: FileAttachment[];
  pendingMessage: string | null;
  togglePanel: () => void;
  setIsOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setActiveConversationId: (id: string | null) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  startNewChat: () => void;
  setPendingMessage: (message: string | null) => void;
  addAttachment: (attachment: FileAttachment) => void;
  updateAttachment: (path: string, patch: Partial<FileAttachment>) => void;
  removeAttachment: (path: string) => void;
  clearAttachments: () => void;
};

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const STORAGE_KEY = 'chat-panel-state';
const DEFAULT_STATE: ChatPanelState = {
  isOpen: true,
  width: DEFAULT_WIDTH,
  activeConversationId: null,
  activeWorkspaceId: null,
};
const chatPanelStateListeners = new Set<() => void>();
let cachedChatPanelState: ChatPanelState = DEFAULT_STATE;
let hasReadStoredState = false;

function loadState(): Partial<ChatPanelState> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatPanelState>;
      return {
        isOpen: parsed.isOpen ?? true,
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed.width ?? DEFAULT_WIDTH)),
        activeConversationId: parsed.activeConversationId ?? null,
        activeWorkspaceId: parsed.activeWorkspaceId ?? null,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_STATE;
}

function saveState(state: ChatPanelState) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function normalizeState(state: Partial<ChatPanelState>): ChatPanelState {
  return {
    isOpen: state.isOpen ?? DEFAULT_STATE.isOpen,
    width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, state.width ?? DEFAULT_STATE.width)),
    activeConversationId: state.activeConversationId ?? null,
    activeWorkspaceId: state.activeWorkspaceId ?? null,
  };
}

function getChatPanelStateSnapshot(): ChatPanelState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  if (!hasReadStoredState) {
    cachedChatPanelState = normalizeState(loadState());
    hasReadStoredState = true;
  }
  return cachedChatPanelState;
}

function getServerChatPanelStateSnapshot(): ChatPanelState {
  return DEFAULT_STATE;
}

function subscribeToChatPanelState(listener: () => void): () => void {
  chatPanelStateListeners.add(listener);

  if (typeof window === 'undefined') {
    return () => chatPanelStateListeners.delete(listener);
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    hasReadStoredState = false;
    listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    chatPanelStateListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function updateChatPanelState(updater: (state: ChatPanelState) => ChatPanelState): void {
  cachedChatPanelState = normalizeState(updater(getChatPanelStateSnapshot()));
  hasReadStoredState = true;
  saveState(cachedChatPanelState);
  for (const listener of chatPanelStateListeners) listener();
}

const ChatPanelContext = createContext<ChatPanelContextType | null>(null);

export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, width, activeConversationId, activeWorkspaceId } = useSyncExternalStore(
    subscribeToChatPanelState,
    getChatPanelStateSnapshot,
    getServerChatPanelStateSnapshot,
  );
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pendingMessage, setPendingMessageState] = useState<string | null>(null);

  const setIsOpen = useCallback((open: boolean) => {
    updateChatPanelState((state) => ({ ...state, isOpen: open }));
  }, []);

  const togglePanel = useCallback(() => {
    updateChatPanelState((state) => ({ ...state, isOpen: !state.isOpen }));
  }, []);

  const setWidth = useCallback((w: number) => {
    updateChatPanelState((state) => ({ ...state, width: w }));
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    updateChatPanelState((state) => ({ ...state, activeConversationId: id }));
  }, []);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    updateChatPanelState((state) => ({ ...state, activeWorkspaceId: id }));
  }, []);

  const startNewChat = useCallback(() => {
    updateChatPanelState((state) => ({ ...state, isOpen: true, activeConversationId: null }));
    setAttachments([]);
    setPendingMessageState(null);
  }, []);

  const setPendingMessage = useCallback((message: string | null) => {
    setPendingMessageState(message);
  }, []);

  const addAttachment = useCallback((attachment: FileAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.path === attachment.path)) return prev;
      return [...prev, attachment];
    });
    updateChatPanelState((state) => ({ ...state, isOpen: true }));
  }, []);

  const updateAttachment = useCallback((path: string, patch: Partial<FileAttachment>) => {
    setAttachments((prev) =>
      prev.map((attachment) => (attachment.path === path ? { ...attachment, ...patch } : attachment)),
    );
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return (
    <ChatPanelContext.Provider
      value={{
        isOpen,
        width,
        activeConversationId,
        activeWorkspaceId,
        attachments,
        pendingMessage,
        togglePanel,
        setIsOpen,
        setWidth,
        setActiveConversationId,
        setActiveWorkspaceId,
        startNewChat,
        setPendingMessage,
        addAttachment,
        updateAttachment,
        removeAttachment,
        clearAttachments,
      }}
    >
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  const ctx = useContext(ChatPanelContext);
  if (!ctx) throw new Error('useChatPanel must be used within ChatPanelProvider');
  return ctx;
}
