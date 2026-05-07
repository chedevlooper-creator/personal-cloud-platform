'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { CommandPalette } from '@/components/app-shell/command-palette';
import { useChatPanel } from '@/components/chat/chat-panel-context';

export function KeyboardShortcutProvider({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const { startNewChat, togglePanel } = useChatPanel();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      if (!isCommand) return;

      const key = event.key.toLowerCase();

      if (key === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }

      if (key === 'n') {
        event.preventDefault();
        startNewChat();
      }

      if (key === 'j') {
        event.preventDefault();
        togglePanel();
      }

      if (key === 'u') {
        event.preventDefault();
        window.dispatchEvent(new Event('app:open-file-upload'));
      }
    };

    const openCommandPalette = () => setCommandOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:open-command-palette', openCommandPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:open-command-palette', openCommandPalette);
    };
  }, [startNewChat, togglePanel]);

  return (
    <>
      {children}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
