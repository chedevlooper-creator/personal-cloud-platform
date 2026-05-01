'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
  removeAttachment: (path: string) => void;
  clearAttachments: () => void;
};

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const STORAGE_KEY = 'chat-panel-state';

function loadState(): Partial<ChatPanelState> {
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
  return { isOpen: true, width: DEFAULT_WIDTH, activeConversationId: null, activeWorkspaceId: null };
}

function saveState(state: ChatPanelState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const ChatPanelContext = createContext<ChatPanelContextType | null>(null);

export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  const initial = loadState();
  const [isOpen, setIsOpenState] = useState<boolean>(initial.isOpen ?? true);
  const [width, setWidthState] = useState<number>(initial.width ?? DEFAULT_WIDTH);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(
    initial.activeConversationId ?? null,
  );
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    initial.activeWorkspaceId ?? null,
  );
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pendingMessage, setPendingMessageState] = useState<string | null>(null);

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpenState((prev) => !prev);
  }, []);

  const setWidth = useCallback((w: number) => {
    setWidthState(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdState(id);
  }, []);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
  }, []);

  const startNewChat = useCallback(() => {
    setActiveConversationIdState(null);
    setAttachments([]);
    setPendingMessageState(null);
    setIsOpenState(true);
  }, []);

  const setPendingMessage = useCallback((message: string | null) => {
    setPendingMessageState(message);
  }, []);

  const addAttachment = useCallback((attachment: FileAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.path === attachment.path)) return prev;
      return [...prev, attachment];
    });
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  // Persist state changes
  useEffect(() => {
    saveState({ isOpen, width, activeConversationId, activeWorkspaceId });
  }, [isOpen, width, activeConversationId, activeWorkspaceId]);

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
