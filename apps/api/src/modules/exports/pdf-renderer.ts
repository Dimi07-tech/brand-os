import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright-core';
import type { Env } from '../../config/env.js';

const CANDIDATE_PATHS = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];

/** Génération PDF par navigateur sans interface (§7.1) : rendu fidèle des modèles HTML. */
@Injectable()
export class PdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderer.name);
  private browser: Promise<Browser> | null = null;
  private readonly executablePath: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.executablePath = config.get('CHROMIUM_PATH', { infer: true }) || CANDIDATE_PATHS.find((p) => existsSync(p));
  }

  /**
   * Rend un document HTML autonome en PDF A4. Le contenu ne peut rien charger
   * depuis le réseau (tout est intégré) et sa politique CSP interdit les scripts ;
   * seul Playwright agit sur la page, pour attendre le chargement des polices.
   */
  async render(
    html: string,
    format: { width: string; height: string } | 'A4' = 'A4',
    /** Pied de page répété sur chaque page (HTML déjà échappé), avec pagination. */
    footer?: string,
  ): Promise<Uint8Array> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ offline: true });
    try {
      const tab = await context.newPage();
      await tab.route('**/*', (route) => (route.request().url().startsWith('data:') ? route.continue() : route.abort()));
      await tab.setContent(html, { waitUntil: 'load', timeout: 20_000 });
      await tab.evaluate(async () => {
        await document.fonts.ready;
      });
      const size = format === 'A4' ? { format: 'A4' as const } : format;
      return await tab.pdf({
        ...size,
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        ...(footer && {
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate:
            `<div style="width:100%;padding:0 15mm;font-family:sans-serif;font-size:7px;color:#777;display:flex;justify-content:space-between">` +
            `<span>${footer}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
        }),
      });
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) await (await this.browser).close().catch(() => undefined);
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      if (!this.executablePath) throw new Error('Chromium introuvable : renseignez CHROMIUM_PATH.');
      this.logger.log(`Lancement de Chromium : ${this.executablePath}`);
      this.browser = chromium.launch({ executablePath: this.executablePath, args: ['--disable-dev-shm-usage'] });
      this.browser.catch(() => (this.browser = null));
    }
    return this.browser;
  }
}
