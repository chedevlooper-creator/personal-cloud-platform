import { createHash } from 'crypto';
import { EmbeddingProvider } from './types';

/**
 * Deterministic, dependency-free embedding provider used as a fallback when
 * no remote embedding service (OpenAI, MiniMax, ...) is configured. Quality
 * is far below a real model, but it keeps the memory pipeline working in
 * local / offline environments without changing the schema dimension.
 */
export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  constructor(private dimensions: number = 1536) {}

  async generate(input: string): Promise<number[]> {
    return this.embed(input);
  }

  async generateBatch(inputs: string[]): Promise<number[][]> {
    return inputs.map((i) => this.embed(i));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private embed(text: string): number[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const vec = new Float64Array(this.dimensions);
    if (tokens.length === 0) return Array.from(vec);

    for (const token of tokens) {
      const hash = createHash('sha256').update(token).digest();
      // Distribute the 32-byte hash into the vector by repeating it across slots,
      // using signed values [-1, 1] for richer projection.
      for (let i = 0; i < this.dimensions; i++) {
        const byte = hash[i % hash.length] ?? 0;
        const signed = (byte - 127.5) / 127.5;
        vec[i] = (vec[i] ?? 0) + signed;
      }
    }

    // L2-normalize so cosine distance behaves correctly in pgvector.
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) norm += (vec[i] ?? 0) ** 2;
    norm = Math.sqrt(norm) || 1;
    const out = new Array<number>(this.dimensions);
    for (let i = 0; i < this.dimensions; i++) out[i] = (vec[i] ?? 0) / norm;
    return out;
  }
}
