'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        'max-w-none text-[14px] leading-[1.65] text-zinc-100',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5',
        '[&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:mt-2 [&_h3]:mb-1',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-300',
        '[&_a]:text-zinc-100 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-zinc-500 hover:[&_a]:decoration-zinc-200',
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
          ? 'text-base font-semibold text-zinc-50'
          : level === 2
            ? 'text-[15px] font-semibold text-zinc-100'
            : 'text-sm font-semibold text-zinc-200';
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
        <ol key={key++} className="list-decimal pl-5 marker:text-zinc-500">
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
        <ul key={key++} className="list-disc pl-5 marker:text-zinc-500">
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
  // eslint-disable-next-line no-constant-condition
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
          className="rounded bg-zinc-800/80 px-1 py-[1px] font-mono text-[12.5px] text-zinc-100 ring-1 ring-white/[0.04]"
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
        <strong key={key++} className="font-semibold text-zinc-50">
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
        <em key={key++} className="italic text-zinc-200">
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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="group/code my-2 overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-3 py-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[12.5px] leading-[1.6] text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
