'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Copy, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

/**
 * Lightweight, dependency-free Markdown renderer tuned for chat messages.
 * Supports: fenced code blocks (```lang), inline code, bold, italic, links,
 * unordered/ordered lists, blockquotes, headings (# ##), and paragraphs.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <div
      className={cn(
        'max-w-none text-sm leading-[1.65] text-foreground',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5',
        '[&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:mt-2 [&_h3]:mb-1',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary',
        className,
      )}
    >
      {renderBlocks(text)}
    </div>
  );
}

function renderBlocks(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Fenced code block
    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing fence
      blocks.push(<CodeBlock key={key++} lang={lang} code={buf.join('\n')} />);
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const content = heading[2] ?? '';
      const cls =
        level === 1
          ? 'text-base font-semibold text-foreground'
          : level === 2
            ? 'text-[15px] font-semibold text-foreground'
            : 'text-sm font-semibold text-foreground/90';
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(content)}
        </p>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++}>
          <p>{renderInline(buf.join(' '))}</p>
        </blockquote>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 marker:text-muted-foreground">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 marker:text-muted-foreground">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line — paragraph separator
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^```/.test(lines[i] ?? '') &&
      !/^#{1,3}\s+/.test(lines[i] ?? '') &&
      !/^>\s?/.test(lines[i] ?? '') &&
      !/^\s*\d+\.\s+/.test(lines[i] ?? '') &&
      !/^\s*[-*]\s+/.test(lines[i] ?? '')
    ) {
      buf.push(lines[i] ?? '');
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(buf.join(' '))}</p>);
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  // Tokenize: code → bold → italic → link
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (true) {
    const codeIdx = rest.indexOf('`');
    const boldIdx = rest.indexOf('**');
    const italicIdx = matchItalic(rest);
    const linkIdx = rest.search(/\[[^\]]+\]\([^)]+\)/);

    const candidates = [
      { kind: 'code' as const, idx: codeIdx },
      { kind: 'bold' as const, idx: boldIdx },
      { kind: 'italic' as const, idx: italicIdx },
      { kind: 'link' as const, idx: linkIdx },
    ].filter((c) => c.idx >= 0);

    if (candidates.length === 0) {
      if (rest) nodes.push(rest);
      break;
    }

    candidates.sort((a, b) => a.idx - b.idx);
    const next = candidates[0]!;
    if (next.idx > 0) nodes.push(rest.slice(0, next.idx));

    if (next.kind === 'code') {
      const after = rest.slice(next.idx + 1);
      const close = after.indexOf('`');
      if (close < 0) {
        nodes.push(rest.slice(next.idx));
        break;
      }
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-[1px] font-mono text-[12.5px] text-foreground ring-1 ring-border/50"
        >
          {after.slice(0, close)}
        </code>,
      );
      rest = after.slice(close + 1);
    } else if (next.kind === 'bold') {
      const after = rest.slice(next.idx + 2);
      const close = after.indexOf('**');
      if (close < 0) {
        nodes.push(rest.slice(next.idx));
        break;
      }
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {renderInline(after.slice(0, close))}
        </strong>,
      );
      rest = after.slice(close + 2);
    } else if (next.kind === 'italic') {
      const after = rest.slice(next.idx + 1);
      const close = after.search(/(?<![*])\*(?!\*)/);
      if (close < 0) {
        nodes.push(rest.slice(next.idx));
        break;
      }
      nodes.push(
        <em key={key++} className="italic text-foreground">
          {renderInline(after.slice(0, close))}
        </em>,
      );
      rest = after.slice(close + 1);
    } else {
      const m = rest.slice(next.idx).match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!m) {
        nodes.push(rest.slice(next.idx));
        break;
      }
      nodes.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
          {m[1]}
        </a>,
      );
      rest = rest.slice(next.idx + (m[0]?.length ?? 0));
    }
  }
  return nodes;
}

function matchItalic(text: string): number {
  // Match a single * not adjacent to another *
  const m = text.match(/(^|[^*])\*(?!\*)/);
  if (!m || m.index === undefined) return -1;
  return m.index + (m[1] ? m[1].length : 0);
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const apply = () => {
    // Suggest a filename based on language
    const extMap: Record<string, string> = {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
      jsx: 'jsx', tsx: 'tsx', python: 'py', py: 'py',
      java: 'java', cpp: 'cpp', c: 'c', go: 'go',
      rust: 'rs', rs: 'rs', php: 'php', ruby: 'rb',
      html: 'html', css: 'css', json: 'json', yaml: 'yaml',
      yml: 'yml', markdown: 'md', md: 'md', sql: 'sql',
      bash: 'sh', shell: 'sh', sh: 'sh',
    };
    const ext = extMap[lang.toLowerCase()] ?? '';
    const filename = ext ? `generated.${ext}` : 'generated.txt';

    window.dispatchEvent(
      new CustomEvent('app:apply-code-to-workspace', {
        detail: { code, filename, lang },
      }),
    );
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  };

  return (
    <div className="group/code my-2 overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {lang || 'code'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            aria-label={applied ? 'Uygulandı' : 'Çalışma alanına kaydet'}
            className="flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {applied ? (
              <>
                <Check className="h-3 w-3" /> Uygulandı
              </>
            ) : (
              <>
                <Save className="h-3 w-3" /> Uygula
              </>
            )}
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Kopyalandı' : 'Kopyala'}
            className="flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Kopyalandı
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Kopyala
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[12.5px] leading-[1.6] text-foreground">
        <code ref={codeRef} className={lang ? `language-${lang}` : undefined}>
          {code}
        </code>
      </pre>
    </div>
  );
}
