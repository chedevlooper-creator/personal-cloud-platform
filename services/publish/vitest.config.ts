import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  css: {
    postcss: {},
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
