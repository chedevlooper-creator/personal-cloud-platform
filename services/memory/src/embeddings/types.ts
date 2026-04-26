export interface EmbeddingProvider {
  generate(input: string): Promise<number[]>;
  generateBatch(inputs: string[]): Promise<number[][]>;
  getDimensions(): number;
}
