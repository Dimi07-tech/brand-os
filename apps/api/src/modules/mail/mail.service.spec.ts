import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { MailService } from './mail.service.js';

function serviceWith(smtpUrl: string | undefined) {
  const values: Partial<Env> = { SMTP_URL: smtpUrl, MAIL_FROM: 'Brand OS <test@brandos.local>', NODE_ENV: 'test' };
  return new MailService({ get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>);
}

const message = { to: 'aicha@example.com', subject: 'Test', text: 'Bonjour', html: '<p>Bonjour</p>' };

describe('MailService', () => {
  it('n’échoue pas si le serveur SMTP est injoignable', async () => {
    // Port 1 : connexion refusée immédiatement.
    await expect(serviceWith('smtp://127.0.0.1:1').send(message)).resolves.toBe(false);
  });

  it('conserve le message hors production, même sans SMTP', async () => {
    const service = serviceWith(undefined);
    await expect(service.send(message)).resolves.toBe(false);
    expect(service.outbox).toEqual([message]);
  });
});
