'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function WorkspaceTerminal({ workspaceId }: { workspaceId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: 'monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    xterm.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;

    // A fake welcome message for the MVP
    xterm.writeln('\x1b[1;32mPersonal Cloud Platform\x1b[0m Terminal');
    xterm.writeln(`Connecting to runtime for workspace: ${workspaceId}...`);
    
    // Connect to WebSocket (Mocking the real URL logic)
    // In reality, it would connect to WS /runtimes/:id/terminal
    // const ws = new WebSocket(`ws://localhost:3003/api/runtimes/${workspaceId}/terminal`);
    // wsRef.current = ws;
    
    // ws.onopen = () => xterm.writeln('\r\n\x1b[32mConnected.\x1b[0m');
    // ws.onmessage = (e) => xterm.write(e.data);
    
    // xterm.onData((data) => {
    //   if (ws.readyState === WebSocket.OPEN) {
    //     ws.send(data);
    //   }
    // });

    // Dummy logic for demonstration
    setTimeout(() => {
      xterm.write('\r\n$ ');
    }, 1000);

    xterm.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.keyCode === 13) {
        xterm.write('\r\n$ ');
      } else if (domEvent.keyCode === 8) {
        // Do not delete the prompt
        if (xterm.buffer.active.cursorX > 2) {
          xterm.write('\b \b');
        }
      } else if (printable) {
        xterm.write(key);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      wsRef.current?.close();
    };
  }, [workspaceId]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-8 items-center bg-[#2d2d2d] px-4 text-xs font-semibold text-zinc-300">
        TERMINAL
      </div>
      <div className="flex-1 bg-[#1e1e1e] p-2" ref={terminalRef} />
    </div>
  );
}
