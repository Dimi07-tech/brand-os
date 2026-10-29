import { defineConfig } from 'vitest/config';

// Tests de bout en bout sur une vraie base PostgreSQL (DATABASE_URL du .env racine).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    // File Redis propre aux tests : un serveur de dev lancé ne leur prend pas leurs tâches.
    env: { NODE_ENV: 'test', PWNED_PASSWORD_CHECK: 'false', SMTP_URL: '', QUEUE_PREFIX: 'brandos-test' },
  },
});
