import {
  completePalette,
  composeLogoProposals,
  defaultGuidelinesText,
  generatePalettes,
  renderLogoSvg,
  ruleBasedCreativeBrief,
  type BrandBrief,
} from '@brand-os/shared';
import { unzipSync, strFromU8 } from 'fflate';
import { slugify } from './brand-snapshot.js';
import { FontLibrary } from './font-library.js';
import { escapeHtml, renderGuidelinesHtml } from './guidelines-template.js';
import { buildLogoPack, rasterize } from './logo-pack.js';

const fonts = new FontLibrary();
const brief: BrandBrief = {
  name: 'Chez Aïcha',
  slogan: 'Le goût de Cotonou',
  sector: 'restauration',
  audience: ['familles'],
  values: ['convivialite', 'qualite', 'authenticite'],
  style: 'ludique',
  preferredColors: ['orange'],
  avoidedColors: [],
};
const palettes = generatePalettes(brief, 1);
const logo = composeLogoProposals(brief, ruleBasedCreativeBrief(brief, 1), palettes, 1)[0]!;
const colors = palettes[0]!.colors;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe('polices (RG-24)', () => {
  it('charge toutes les polices du catalogue, à toutes les graisses utilisées', () => {
    expect(() => fonts.assertCatalog()).not.toThrow();
  });

  it('dessine les lettres des langues du Bénin (ɖ, ɔ, ɛ) grâce au sous-ensemble latin-ext', () => {
    const style = { family: 'Montserrat', weight: 700, size: 40, letterSpacing: 0 };
    const [font] = fonts.fonts('Montserrat', 700);
    expect(font!.charToGlyph('ɖ').index).toBe(0); // absent du sous-ensemble latin…
    const path = fonts.engine.outline!('Ɖɔ̃kpɛ', style, 0, 40);
    expect(path.length).toBeGreaterThan(200); // …mais bien dessiné
    expect(fonts.engine.measure('ɖɔɛ', style)).toBeGreaterThan(40);
  });
});

describe('logo vectoriel (RG-23)', () => {
  it('convertit tout le texte en tracés', () => {
    const { svg } = renderLogoSvg(logo, 'color', fonts.engine);
    expect(svg).not.toContain('<text');
    expect(svg).toMatch(/<path d="M/);
  });

  it('rend un PNG transparent à la largeur demandée', () => {
    const png = rasterize(renderLogoSvg(logo, 'color', fonts.engine).svg, 800);
    expect(Array.from(png.subarray(0, 4))).toEqual(PNG_SIGNATURE);
    const width = new DataView(png.buffer, png.byteOffset).getUint32(16);
    expect(width).toBe(800);
  });
});

describe('pack de logos (US-31)', () => {
  const pack = (paid: boolean) =>
    unzipSync(
      buildLogoPack(
        { slug: 'chez-aicha', name: 'Chez Aïcha', logo, colors, version: 1, includesVector: paid, watermarked: !paid },
        fonts.engine,
      ),
    );

  it('contient SVG et PNG de chaque variante pour une offre payante', () => {
    const files = Object.keys(pack(true));
    expect(files.filter((f) => f.endsWith('.svg'))).toHaveLength(7);
    expect(files.filter((f) => f.endsWith('.png'))).toHaveLength(7);
    expect(files).toContain('chez-aicha-logos/couleurs.txt');
    expect(files).toContain('chez-aicha-logos/LISEZMOI.txt');
  });

  it('ne contient que des PNG en offre Gratuite, et le signale', () => {
    const files = pack(false);
    expect(Object.keys(files).some((f) => f.endsWith('.svg'))).toBe(false);
    expect(strFromU8(files['chez-aicha-logos/LISEZMOI.txt']!)).toMatch(/filigrane/);
  });

  it('ajoute un filigrane aux PNG de l’offre Gratuite', () => {
    const free = pack(false)['chez-aicha-logos/png/chez-aicha-couleur.png']!;
    const paid = pack(true)['chez-aicha-logos/png/chez-aicha-couleur.png']!;
    expect(Array.from(free.subarray(0, 4))).toEqual(PNG_SIGNATURE);
    expect(free).not.toEqual(paid);
  });

  it('liste les couleurs en HEX, RGB et CMJN (RG-21)', () => {
    const text = strFromU8(pack(true)['chez-aicha-logos/couleurs.txt']!);
    const primary = colors.find((c) => c.role === 'primary')!;
    expect(text).toContain(primary.hex.toUpperCase());
    expect(text).toContain(`CMJN ${primary.cmyk.join(', ')}`);
  });
});

describe('charte graphique (US-40)', () => {
  const input = {
    name: 'Chez Aïcha',
    slogan: 'Le goût de Cotonou',
    logo,
    colors: completePalette({ colors: colors.map(({ role, hex }) => ({ role, hex })) }).colors,
    typography: { heading: logo.font, body: 'Inter' },
    texts: defaultGuidelinesText(brief),
    version: 3,
    date: new Date('2026-10-29'),
    organization: { name: 'Chez Aïcha', city: 'Cotonou', phone: null, email: null, website: null },
  };

  it('contient toutes les rubriques demandées (§4.5)', () => {
    const html = renderGuidelinesHtml(input, fonts.engine, '');
    for (const heading of ['Qui nous sommes', 'Notre mission', 'Nos valeurs', 'Le logo et ses versions', 'Bien utiliser le logo', 'La palette', 'Les polices', 'La marque en situation']) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('version 3');
    expect(html).toContain('29 octobre 2026');
  });

  it('échappe les textes saisis et interdit les scripts', () => {
    const html = renderGuidelinesHtml(
      { ...input, texts: { ...input.texts, mission: '<script>alert(1)</script><img src=x onerror=alert(1)>' } },
      fonts.engine,
      '',
    );
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain(escapeHtml('<script>'));
    expect(html).toContain(`default-src 'none'`);
  });
});

it('produit des noms de fichiers sûrs', () => {
  expect(slugify('Chez Aïcha')).toBe('chez-aicha');
  expect(slugify('../../etc/passwd')).toBe('etc-passwd');
  expect(slugify('Ɖokpo & Fils')).toBe('dokpo-fils');
  expect(slugify('Sɛ̀ Mɔ̃')).toBe('se-mo');
  expect(slugify('***')).toBe('marque');
});
