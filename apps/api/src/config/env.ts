import { z } from 'zod';

const bool = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');

const optionalUrl = z.url().optional().or(z.literal('').transform(() => undefined));

// Variables d'environnement validées au démarrage : l'API refuse de démarrer si
// une valeur manque ou est invalide.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Sans SMTP_URL, les e-mails sont seulement journalisés (développement).
  SMTP_URL: optionalUrl,
  MAIL_FROM: z.string().default('Brand OS <no-reply@brandos.local>'),
  // RG-01 : vérification des mots de passe compromis (Have I Been Pwned)
  PWNED_PASSWORD_CHECK: bool('true'),
  // Stockage des fichiers (§7.1) : disque local en développement, compatible S3 en production
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('../../.dev/storage'),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  // Signature des liens de téléchargement du stockage local (§9.1)
  FILE_SIGNING_SECRET: z.string().min(32, 'Au moins 32 caractères aléatoires'),
  // Tâches de fond (exports) : traitées dans ce processus, ou par un worker séparé (dist/worker.js)
  WORKERS_ENABLED: bool('true'),
  // Préfixe des files Redis : isole les tests (et plusieurs environnements sur un même Redis)
  QUEUE_PREFIX: z.string().regex(/^[a-z0-9-]+$/).default('brandos'),
  // Chromium pour les PDF (Playwright) ; détecté automatiquement si absent
  CHROMIUM_PATH: z.string().optional(),
  // Conversion CMJN des PDF d'impression (RG-50)
  GHOSTSCRIPT_PATH: z.string().default('gs'),
})
  // Sans SMTP, les e-mails (et leurs liens de connexion) partiraient dans les logs.
  .refine((env) => env.NODE_ENV !== 'production' || env.SMTP_URL, {
    message: 'SMTP_URL est obligatoire en production',
    path: ['SMTP_URL'],
  })
  .refine((env) => env.STORAGE_DRIVER !== 's3' || (env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY), {
    message: 'S3_BUCKET, S3_ACCESS_KEY et S3_SECRET_KEY sont obligatoires avec STORAGE_DRIVER=s3',
    path: ['STORAGE_DRIVER'],
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
