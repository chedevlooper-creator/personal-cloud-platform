# xterm.js — apps/web terminal

## Temel kurulum + FitAddon

```tsx
'use client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function Term() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const term = new Terminal({ cursorBlink: true });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current!);
    fit.fit();
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(ref.current!);
    return () => { ro.disconnect(); term.dispose(); };
  }, []);
  return <div ref={ref} className="h-full" />;
}
```

## WebSocket PTY entegrasyonu

```ts
const socket = new WebSocket(`wss://runtime.pcp/${runtimeId}/pty`);
socket.onopen = () => socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
socket.onmessage = (e) => term.write(e.data);
term.onData((d) => socket.readyState === 1 && socket.send(d));
term.onResize(({ cols, rows }) => socket.send(JSON.stringify({ type: 'resize', cols, rows })));
```

## AttachAddon (kısa yol)

```ts
import { AttachAddon } from '@xterm/addon-attach';

const sock = new WebSocket('wss://runtime.pcp/pty');
sock.onopen = () => term.loadAddon(new AttachAddon(sock, { bidirectional: true }));
```

## WebGL renderer (perf)

```ts
import { WebglAddon } from '@xterm/addon-webgl';
try {
  const w = new WebglAddon();
  w.onContextLoss(() => w.dispose());
  term.loadAddon(w);
} catch { /* fallback canvas */ }
```

## Search

```ts
import { SearchAddon } from '@xterm/addon-search';
const search = new SearchAddon();
term.loadAddon(search);
search.findNext('foo');
```

## Proje notları
- WebSocket auth: cookie tabanlı session — sub-protocol veya query-token ile auth.
- Resize event'leri runtime servisine iletilip Docker `container.resize({h,w})` çağrılmalı.
- Disposal: component unmount'ta `term.dispose()` ZORUNLU (memory leak).
