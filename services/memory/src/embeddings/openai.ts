import OpenAI from 'openai';
import { EmbeddingProvider } from './types';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimensions: number = 1536) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.dimensions = dimensions;
  }

  async generate(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input,
      dimensions: this.dimensions,
    });
    return response.data[0]?.embedding || [];
  }

  async generateBatch(inputs: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: inputs,
      dimensions: this.dimensions,
    });
    return response.data.map(d => d.embedding);
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
