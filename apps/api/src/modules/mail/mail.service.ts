import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;
  /** Derniers messages envoyés, conservés hors production pour les tests. */
  readonly outbox: MailMessage[] = [];
  private readonly keepOutbox: boolean;

  constructor(config: ConfigService<Env, true>) {
    const smtpUrl = config.get('SMTP_URL', { infer: true });
    this.transport = smtpUrl ? createTransport(smtpUrl) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
    this.keepOutbox = config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  /**
   * N'échoue jamais : une panne du serveur d'e-mails ne doit pas faire échouer
   * l'action en cours (ex. une inscription déjà enregistrée). L'utilisateur peut
   * redemander le lien. À terme : envoi via la file BullMQ, avec nouvelles tentatives.
   */
  async send(message: MailMessage): Promise<boolean> {
    if (this.keepOutbox) {
      this.outbox.push(message);
      if (this.outbox.length > 50) this.outbox.shift();
    }
    if (!this.transport) {
      this.logger.log(`[e-mail non envoyé, SMTP_URL absent] À : ${message.to} — ${message.subject}\n${message.text}`);
      return false;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message });
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi de l'e-mail « ${message.subject} » : ${(err as Error).message}`);
      return false;
    }
  }
}
