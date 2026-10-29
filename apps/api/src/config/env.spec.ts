import { validateEnv } from './env.js';

const valid = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  FILE_SIGNING_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    expect(validateEnv(valid)).toMatchObject({ NODE_ENV: 'development', API_PORT: 4000 });
  });

  it('refuse une configuration incomplète', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('exige un serveur SMTP en production', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/SMTP_URL/);
    expect(validateEnv({ ...valid, NODE_ENV: 'production', SMTP_URL: 'smtp://mail:587' }).SMTP_URL).toBe('smtp://mail:587');
  });
});
