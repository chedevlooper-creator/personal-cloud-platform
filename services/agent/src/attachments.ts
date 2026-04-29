import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export interface ExtractedAttachment {
  filename: string;
  mimetype: string;
  bytes: number;
  text: string;
  truncated: boolean;
  ocrUsed?: boolean;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TEXT_CHARS = 30_000; // ~7-8k tokens per file
const SCANNED_PDF_THRESHOLD = 200; // <200 chars of extracted text → likely scanned/image PDF
const VISION_PDF_MAX_BYTES = 8 * 1024 * 1024; // Anthropic accepts up to 32MB; we cap to 8MB

export async function extractAttachment(
  filename: string,
  mimetype: string,
  buffer: Buffer,
): Promise<ExtractedAttachment> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File ${filename} exceeds 10MB limit`);
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let raw = '';
  let ocrUsed = false;

  try {
    if (ext === 'pdf' || mimetype === 'application/pdf') {
      // Lazy import to avoid pdf-parse's debug-mode index file pulling test fixtures.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (
        data: Buffer,
      ) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      raw = result.text || '';

      // If the embedded text layer is empty/tiny, treat as scanned PDF and try
      // a vision model fallback. Order: Gemini (cheap+strong OCR) → Anthropic.
      if (raw.trim().length < SCANNED_PDF_THRESHOLD) {
        const ocrText =
          (await tryGeminiPdfExtract(filename, buffer)) ??
          (await tryAnthropicPdfExtract(filename, buffer));
        if (ocrText) {
          raw = ocrText;
          ocrUsed = true;
        } else if (raw.trim().length === 0) {
          raw =
            `[This PDF appears to be a scanned/image document with no extractable text. ` +
            `OCR fallback was unavailable — set GEMINI_API_KEY (preferred) or ANTHROPIC_API_KEY ` +
            `in the agent service environment to enable automatic PDF OCR.]`;
        }
      }
    } else if (
      ext === 'xlsx' ||
      ext === 'xls' ||
      ext === 'csv' ||
      mimetype.includes('spreadsheet') ||
      mimetype === 'text/csv'
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      raw = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return '';
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `## Sheet: ${name}\n${csv}`;
      }).join('\n\n');
    } else if (
      ext === 'docx' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value || '';
    } else if (
      ext === 'txt' ||
      ext === 'md' ||
      ext === 'json' ||
      ext === 'log' ||
      ext === 'yaml' ||
      ext === 'yml' ||
      ext === 'xml' ||
      ext === 'html' ||
      mimetype.startsWith('text/') ||
      mimetype === 'application/json'
    ) {
      raw = buffer.toString('utf8');
    } else {
      throw new Error(
        `Unsupported file type: ${filename} (${mimetype}). Supported: PDF, DOCX, XLSX/XLS/CSV, TXT, MD, JSON, LOG, YAML, XML, HTML.`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Unsupported')) throw err;
    throw new Error(
      `Failed to read ${filename}: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }

  const trimmed = raw.trim();
  const truncated = trimmed.length > MAX_TEXT_CHARS;
  const text = truncated ? `${trimmed.slice(0, MAX_TEXT_CHARS)}\n\n[...content truncated]` : trimmed;

  return {
    filename,
    mimetype,
    bytes: buffer.length,
    text,
    truncated,
    ocrUsed,
  };
}

const OCR_PROMPT =
  'Extract all readable text, tables and structured data from every page of the attached PDF. ' +
  'Preserve the original ordering. Output plain text only — no commentary, no markdown headers, ' +
  'no preamble. If a page is unreadable, write "[unreadable page N]".';

/**
 * Vision OCR via Google Gemini. Gemini 2.0 Flash accepts inline PDFs (base64)
 * and returns OCR'd plain text very cheaply and accurately. Used as the
 * primary OCR fallback when a PDF has no embedded text layer.
 */
async function tryGeminiPdfExtract(filename: string, buffer: Buffer): Promise<string | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (buffer.length > VISION_PDF_MAX_BYTES) return null;

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(env.GEMINI_OCR_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: buffer.toString('base64'),
                },
              },
              { text: `File: ${filename}\n\n${OCR_PROMPT}` },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Vision OCR via Anthropic Claude. Used as a secondary fallback when Gemini
 * is unavailable. Claude accepts a base64 PDF as a `document` content block
 * and OCRs+reads it in a single call.
 */
async function tryAnthropicPdfExtract(filename: string, buffer: Buffer): Promise<string | null> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (buffer.length > VISION_PDF_MAX_BYTES) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
            { type: 'text', text: `File: ${filename}\n\n${OCR_PROMPT}` },
          ],
        },
      ],
    });

    const combined = response.content
      .filter((part): part is Anthropic.TextBlock => part.type === 'text')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
    return combined.length > 0 ? combined : null;
  } catch {
    return null;
  }
}

export function buildAttachmentContext(attachments: ExtractedAttachment[]): string {
  if (attachments.length === 0) return '';
  const blocks = attachments.map((a) => {
    const ocrAttr = a.ocrUsed ? ' ocr="vision-llm"' : '';
    return `<attachment filename="${a.filename}" type="${a.mimetype}" bytes="${a.bytes}"${ocrAttr}>\n${a.text}\n</attachment>`;
  });
  return `The user has attached ${attachments.length} file${
    attachments.length === 1 ? '' : 's'
  }. Use them as context when responding.\n\n${blocks.join('\n\n')}\n\n---\nUser message:\n`;
}
