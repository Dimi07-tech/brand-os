import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '../../.env' });

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Les tests partagent une même base : exécution séquentielle.
    fileParallelism: false,
  },
});
