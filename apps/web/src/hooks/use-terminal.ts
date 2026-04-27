import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface UseTerminalOptions {
  runtimeId: string;
  onCommandBlocked?: (command: string) => void;
}

export function useTerminal({ runtimeId, onCommandBlocked }: UseTerminalOptions) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/runtimes/${runtimeId}/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      term.writeln('\r\n\x1b[32m--- Connected to CloudMind Terminal ---\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      setIsConnected(false);
      term.writeln('\r\n\x1b[31m--- Connection Closed ---\x1b[0m\r\n');
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m--- Connection Error ---\x1b[0m\r\n');
    };

    // Client-side interceptor for simple risk checks
    // We intercept data being sent to WS.
    let inputBuffer = '';

    term.onData((data) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      // Simple frontend blocker for specific strings
      // Note: This is rudimentary. In a real PTY, data comes char by char.
      // We buffer characters until enter is pressed (\r)
      if (data === '\r') {
        const blockedPatterns = [/rm\s+-rf\s+\//, /^sudo\b/, /:\(\)\{\s*:\|:&\s*\};:/];
        const isBlocked = blockedPatterns.some(pattern => pattern.test(inputBuffer.trim()));
        
        if (isBlocked) {
          term.writeln('\r\n\x1b[31mError: Command blocked by security policy.\x1b[0m');
          if (onCommandBlocked) onCommandBlocked(inputBuffer.trim());
          inputBuffer = '';
          // Send a newline to PTY to give back the prompt without executing the command
          // Actually sending Ctrl+C is better to cancel the current line
          ws.send('\x03'); 
          return;
        }
        inputBuffer = '';
      } else if (data === '\x7f') { // Backspace
        inputBuffer = inputBuffer.slice(0, -1);
      } else if (data === '\x03') { // Ctrl+C
        inputBuffer = '';
      } else {
        inputBuffer += data;
      }

      ws.send(data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [runtimeId, onCommandBlocked]);

  return { terminalRef, isConnected };
}
