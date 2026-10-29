import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { CARD } from '@brand-os/shared';
import type { Env } from '../../config/env.js';

const run = promisify(execFile);
const MM_TO_PT = 72 / 25.4;

/**
 * PDF prêt pour l'imprimeur (RG-50). Chromium produit un PDF vectoriel en RGB ;
 * Ghostscript le convertit en CMJN (profils ICC par défaut), puis on inscrit les
 * cadres d'impression : BleedBox (fond perdu) et TrimBox (format fini, coupe).
 */
@Injectable()
export class PrintPdfService {
  private readonly logger = new Logger(PrintPdfService.name);
  private readonly ghostscript: string;

  constructor(config: ConfigService<Env, true>) {
    this.ghostscript = config.get('GHOSTSCRIPT_PATH', { infer: true });
  }

  async toPrintReady(rgbPdf: Uint8Array, bleedMm: number = CARD.bleed): Promise<Uint8Array> {
    const dir = await mkdtemp(join(tmpdir(), 'brandos-print-'));
    try {
      const input = join(dir, 'rgb.pdf');
      const output = join(dir, 'cmyk.pdf');
      await writeFile(input, rgbPdf);
      await run(
        this.ghostscript,
        [
          '-dSAFER',
          '-dBATCH',
          '-dNOPAUSE',
          '-dQUIET',
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.6',
          '-sColorConversionStrategy=CMYK',
          '-dProcessColorModel=/DeviceCMYK',
          '-dAutoRotatePages=/None',
          '-dEmbedAllFonts=true',
          `-sOutputFile=${output}`,
          input,
        ],
        { timeout: 30_000 },
      ).catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') throw new Error('Ghostscript introuvable : installez-le ou renseignez GHOSTSCRIPT_PATH.');
        throw err;
      });

      const doc = await PDFDocument.load(await readFile(output));
      const bleed = bleedMm * MM_TO_PT;
      for (const page of doc.getPages()) {
        const { width, height } = page.getMediaBox();
        page.setBleedBox(0, 0, width, height);
        page.setTrimBox(bleed, bleed, width - 2 * bleed, height - 2 * bleed);
      }
      doc.setProducer('Brand OS');
      doc.setCreator('Brand OS');
      return await doc.save();
    } finally {
      await rm(dir, { recursive: true, force: true }).catch((err: Error) => this.logger.warn(err.message));
    }
  }
}
