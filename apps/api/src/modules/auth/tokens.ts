import { createHash, randomBytes } from 'node:crypto';

/** Jeton opaque de 256 bits, transmis au client (cookie ou lien e-mail). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Seule cette empreinte est stockée : une fuite de la base ne livre aucun jeton utilisable. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
