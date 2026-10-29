import { Injectable } from '@nestjs/common';
import { FONTS, fontWeights, getFont, type TextEngine, type TextStyle } from '@brand-os/shared';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import opentype, { type Font, type Glyph } from 'opentype.js';

// Polices du catalogue (RG-24), embarquées via Fontsource (licence OFL) : les
// exports ne dépendent d'aucun service externe.

const require = createRequire(import.meta.url);

/** Sous-ensembles chargés : « latin-ext » couvre notamment ɖ, ɔ, ɛ (langues du Bénin). */
const SUBSETS = ['latin', 'latin-ext'] as const;
type Subset = (typeof SUBSETS)[number];

/** Plages Unicode des sous-ensembles (identiques à Google Fonts), pour les @font-face des PDF. */
export const UNICODE_RANGES: Record<Subset, string> = {
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
};

export function fontSlug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, '-');
}

@Injectable()
export class FontLibrary {
  private readonly parsed = new Map<string, Font[]>();

  /** Fichier WOFF d'une police, à la graisse demandée ou la plus proche disponible. */
  file(family: string, weight: number, subset: Subset): Buffer {
    const slug = fontSlug(family);
    const dir = join(dirname(require.resolve(`@fontsource/${slug}/package.json`)), 'files');
    const pattern = new RegExp(`^${slug}-${subset}-(\\d+)-normal\\.woff$`);
    const available = readdirSync(dir)
      .map((f) => Number(pattern.exec(f)?.[1]))
      .filter((w) => !Number.isNaN(w));
    if (available.length === 0) throw new Error(`Police introuvable : ${family} (${subset})`);
    const nearest = available.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
    return readFileSync(join(dir, `${slug}-${subset}-${nearest}-normal.woff`));
  }

  /** Polices analysées, par ordre de préférence (latin puis latin-ext). */
  fonts(family: string, weight: number): Font[] {
    const cacheKey = `${family}:${weight}`;
    let fonts = this.parsed.get(cacheKey);
    if (!fonts) {
      fonts = SUBSETS.map((subset) => {
        const buf = this.file(family, weight, subset);
        return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      });
      this.parsed.set(cacheKey, fonts);
    }
    return fonts;
  }

  /** Règles @font-face (fichiers intégrés en base64) pour le rendu HTML des PDF. */
  fontFaceCss(families: string[]): string {
    return families
      .flatMap((family) => {
        const font = getFont(family);
        if (!font) return [];
        return fontWeights(font).flatMap((weight) =>
          SUBSETS.map(
            (subset) =>
              `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;` +
              `src:url(data:font/woff;base64,${this.file(family, weight, subset).toString('base64')}) format('woff');` +
              `unicode-range:${UNICODE_RANGES[subset]};}`,
          ),
        );
      })
      .join('\n');
  }

  /** Vérifie au démarrage que chaque police du catalogue est bien installée. */
  assertCatalog(): void {
    for (const font of FONTS) for (const weight of fontWeights(font)) this.fonts(font.family, weight);
  }

  /**
   * Moteur de texte vectoriel : le texte des logos devient des tracés (RG-23),
   * le fichier s'affiche à l'identique sans la police installée.
   */
  readonly engine: TextEngine = {
    measure: (text, style) => this.layout(text, style, 0, 0).width,
    outline: (text, style, x, y) => this.layout(text, style, x, y).path,
  };

  private layout(text: string, style: TextStyle, x: number, y: number): { width: number; path: string } {
    const fonts = this.fonts(style.family, style.weight);
    const spacing = style.letterSpacing * style.size;
    let cursor = x;
    let previous: { font: Font; glyph: Glyph } | null = null;
    const paths: string[] = [];

    for (const char of text.normalize('NFC')) {
      // Première police qui contient le caractère (latin, puis latin-ext).
      const font = fonts.find((f) => f.charToGlyph(char).index > 0) ?? fonts[0]!;
      const glyph = font.charToGlyph(char);
      const scale = style.size / font.unitsPerEm;
      if (previous && previous.font === font) cursor += font.getKerningValue(previous.glyph, glyph) * scale;
      const d = glyph.getPath(cursor, y, style.size).toPathData(2);
      if (d) paths.push(d);
      cursor += (glyph.advanceWidth ?? 0) * scale + spacing;
      previous = { font, glyph };
    }
    return { width: cursor - x, path: paths.join('') };
  }
}
