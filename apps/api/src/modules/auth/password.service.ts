import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';
import { createHash } from 'node:crypto';
import type { Env } from '../../config/env.js';

// Paramètres Argon2id recommandés par l'OWASP (19 Mio, 2 itérations).
// algorithm 2 = Algorithm.Argon2id (enum « const » inutilisable avec isolatedModules).
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly pwnedCheck: boolean;
  /** Empreinte factice : une connexion sur un e-mail inconnu prend le même temps. */
  private readonly dummyHash: Promise<string>;

  constructor(config: ConfigService<Env, true>) {
    this.pwnedCheck = config.get('PWNED_PASSWORD_CHECK', { infer: true });
    this.dummyHash = hash('brand-os-dummy-password', ARGON2_OPTIONS);
  }

  /** RG-01 : refuse un mot de passe connu dans des fuites de données, puis le hache. */
  async hashNew(password: string): Promise<string> {
    if (await this.isCompromised(password)) {
      throw new BadRequestException({
        message: 'Données invalides',
        errors: [
          {
            field: 'password',
            message: 'Ce mot de passe figure dans des fuites de données connues. Choisissez-en un autre.',
          },
        ],
      });
    }
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string | null, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }

  /**
   * Have I Been Pwned, par k-anonymat : seuls les 5 premiers caractères de
   * l'empreinte SHA-1 quittent le serveur. En cas de panne du service, on
   * n'empêche pas l'inscription (la longueur minimale reste imposée).
   */
  private async isCompromised(password: string): Promise<boolean> {
    if (!this.pwnedCheck) return false;
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      return body.split('\n').some((line) => {
        const [hashSuffix, count] = line.trim().split(':');
        return hashSuffix === suffix && Number(count) > 0;
      });
    } catch (err) {
      this.logger.warn(`Vérification Have I Been Pwned indisponible : ${(err as Error).message}`);
      return false;
    }
  }
}
