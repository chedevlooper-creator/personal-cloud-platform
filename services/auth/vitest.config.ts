import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://pcp:pcp_dev_password@localhost:5432/pcp',
    },
  },
});
