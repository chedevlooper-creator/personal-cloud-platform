import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface UseTerminalOptions {
  runtimeId: string;
  onCommandBlocked?: (command: string) => void;
}

export type TerminalConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed';

const MAX_RECONNECT_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

/** Exponential backoff with light jitter, capped at MAX_BACKOFF_MS. */
function computeBackoff(attempt: number): number {
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exp;
  return Math.round(exp + jitter);
}

export function useTerminal({ runtimeId, onCommandBlocked }: UseTerminalOptions) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const cancelledRef = useRef(false);

  const [connectionState, setConnectionState] = useState<TerminalConnectionState>('connecting');

  useEffect(() => {
    if (!terminalRef.current) return;

    cancelledRef.current = false;
    attemptsRef.current = 0;

    // Initialize xterm.js once; the Terminal instance is reused across reconnects.
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

    // Buffered input for client-side command screening.
    let inputBuffer = '';

    term.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (data === '\r') {
        const blockedPatterns = [/rm\s+-rf\s+\//, /^sudo\b/, /:\(\)\{\s*:\|:&\s*\};:/];
        const isBlocked = blockedPatterns.some((p) => p.test(inputBuffer.trim()));
        if (isBlocked) {
          term.writeln('\r\n\x1b[31mError: Command blocked by security policy.\x1b[0m');
          onCommandBlocked?.(inputBuffer.trim());
          inputBuffer = '';
          ws.send('\x03');
          return;
        }
        inputBuffer = '';
      } else if (data === '\x7f') {
        inputBuffer = inputBuffer.slice(0, -1);
      } else if (data === '\x03') {
        inputBuffer = '';
      } else {
        inputBuffer += data;
      }

      ws.send(data);
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    const connect = () => {
      if (cancelledRef.current) return;
      const httpBase =
        process.env.NEXT_PUBLIC_RUNTIME_API_URL || 'http://localhost:3003/api';
      // Convert http(s) base to ws(s) WebSocket URL targeting runtime service.
      const wsBase = httpBase.replace(/^http/i, 'ws');
      const wsUrl = `${wsBase}/runtimes/${runtimeId}/terminal`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        setConnectionState('connected');
        term.writeln('\r\n\x1b[32m--- Zihinbulut Terminal\'e bağlandı ---\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[31m--- Connection Error ---\x1b[0m');
      };

      ws.onclose = (event) => {
        if (cancelledRef.current) {
          setConnectionState('closed');
          return;
        }
        // 1000 = normal closure; do not retry intentional closes.
        if (event.code === 1000) {
          setConnectionState('closed');
          term.writeln('\r\n\x1b[31m--- Connection Closed ---\x1b[0m\r\n');
          return;
        }

        const attempt = attemptsRef.current;
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionState('closed');
          term.writeln(
            '\r\n\x1b[31m--- Connection Lost (max reconnect attempts reached) ---\x1b[0m\r\n',
          );
          return;
        }

        const delay = computeBackoff(attempt);
        attemptsRef.current = attempt + 1;
        setConnectionState('reconnecting');
        term.writeln(
          `\r\n\x1b[33m--- Disconnected. Reconnecting in ${
            Math.round(delay / 100) / 10
          }s (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS}) ---\x1b[0m`,
        );

        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    setConnectionState('connecting');
    connect();

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('resize', handleResize);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        // Detach handlers before close so the close handler does not schedule a reconnect.
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close(1000, 'unmount');
      }
      wsRef.current = null;
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [runtimeId, onCommandBlocked]);

  return {
    terminalRef,
    connectionState,
    isConnected: connectionState === 'connected',
  };
}
