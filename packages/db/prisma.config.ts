import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Le .env est unique, à la racine du monorepo.
config({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
