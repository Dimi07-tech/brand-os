import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import type { Env } from '../../config/env.js';
import { PasswordService } from './password.service.js';

const config = { get: () => true } as unknown as ConfigService<Env, true>;
const PASSWORD = 'motdepasse123';
const sha1 = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase();

function mockRange(body: string, ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: ok ? 200 : 503 }));
}

afterEach(() => vi.restoreAllMocks());

describe('PasswordService', () => {
  it('ne transmet que les 5 premiers caractères de l’empreinte (k-anonymat)', async () => {
    const fetch = mockRange('');
    await new PasswordService(config).hashNew(PASSWORD);
    const url = fetch.mock.calls[0]![0] as string;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(url).not.toContain(sha1.slice(5));
  });

  it('refuse un mot de passe compromis (RG-01)', async () => {
    mockRange(`0000000000000000000000000000000000A:0\r\n${sha1.slice(5)}:4210\r\n`);
    await expect(new PasswordService(config).hashNew(PASSWORD)).rejects.toThrow('Données invalides');
  });

  it('ignore les entrées de remplissage à 0 occurrence', async () => {
    mockRange(`${sha1.slice(5)}:0\r\n`);
    await expect(new PasswordService(config).hashNew(PASSWORD)).resolves.toMatch(/^\$argon2id\$/);
  });

  it('n’empêche pas l’inscription si le service est indisponible', async () => {
    mockRange('', false);
    await expect(new PasswordService(config).hashNew(PASSWORD)).resolves.toMatch(/^\$argon2id\$/);
  });

  it('vérifie le mot de passe, et rejette sans erreur une empreinte absente', async () => {
    mockRange('');
    const service = new PasswordService(config);
    const hash = await service.hashNew(PASSWORD);
    expect(await service.verify(hash, PASSWORD)).toBe(true);
    expect(await service.verify(hash, 'autre-mot-de-passe')).toBe(false);
    expect(await service.verify(null, PASSWORD)).toBe(false);
  });
});
