// Moteur du Brand Studio — RG-20 à RG-24, §8.1
import { describe, expect, it } from 'vitest';
import {
  BRAND_VALUES,
  brandBriefSchema,
  checkPalette,
  COLOR_FAMILIES,
  colorFamilyOf,
  composeLogoProposals,
  contrastRatio,
  creativeBriefSchema,
  FONTS,
  generatePalettes,
  generationSeed,
  hexToRgb,
  hslToHex,
  ICONS,
  initials,
  LOGO_VARIANTS,
  logoSpecSchema,
  PALETTE_ROLES,
  paletteColor,
  renderLogoSvg,
  rgbToCmyk,
  ruleBasedCreativeBrief,
  SECTORS,
  toColorValue,
  VISUAL_STYLES,
  type BrandBrief,
} from '../src/index.js';
import { createRandom, pick, shuffle } from '../src/brand/random.js';

const aicha: BrandBrief = {
  name: 'Chez Aïcha',
  slogan: 'Le goût de Cotonou',
  sector: 'restauration',
  audience: ['familles'],
  values: ['convivialite', 'qualite', 'authenticite'],
  style: 'ludique',
  preferredColors: ['orange'],
  avoidedColors: ['violet'],
};

/** Questionnaires variés, reproductibles. */
function* randomBriefs(count: number): Generator<BrandBrief> {
  const random = createRandom(42);
  for (let i = 0; i < count; i++) {
    const colors = shuffle(random, COLOR_FAMILIES);
    const nPreferred = Math.floor(random() * 3);
    const nAvoided = Math.floor(random() * 4);
    yield {
      name: pick(random, ['Chez Aïcha', 'Agossou BTP', 'Sodabi & Co', 'X', 'Institut Lumière Parakou']),
      sector: pick(random, SECTORS),
      audience: ['grand-public'],
      values: shuffle(random, BRAND_VALUES).slice(0, 3),
      style: pick(random, VISUAL_STYLES),
      preferredColors: colors.slice(0, nPreferred),
      avoidedColors: colors.slice(nPreferred, nPreferred + nAvoided),
    };
  }
}

describe('couleurs (RG-21, RG-22)', () => {
  it('convertit HEX, RGB et CMJN', () => {
    expect(hexToRgb('#c2410c')).toEqual([194, 65, 12]);
    expect(toColorValue('#FFF')).toEqual({ hex: '#ffffff', rgb: [255, 255, 255], cmyk: [0, 0, 0, 0] });
    expect(rgbToCmyk([0, 0, 0])).toEqual([0, 0, 0, 100]);
    expect(rgbToCmyk([255, 0, 0])).toEqual([0, 100, 100, 0]);
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
  });

  it('calcule le contraste WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('classe les couleurs par famille', () => {
    expect(colorFamilyOf('#dc2626')).toBe('rouge');
    expect(colorFamilyOf('#2563eb')).toBe('bleu');
    expect(colorFamilyOf('#78350f')).toBe('marron');
    expect(colorFamilyOf('#0a0a0a')).toBe('noir');
    expect(colorFamilyOf('#9ca3af')).toBeNull();
  });
});

describe('questionnaire (US-20)', () => {
  it('accepte un brief complet', () => {
    expect(brandBriefSchema.safeParse(aicha).success).toBe(true);
  });

  it('exige exactement 3 valeurs', () => {
    const result = brandBriefSchema.safeParse({ ...aicha, values: ['qualite', 'fiabilite'] });
    expect(result.error?.issues[0]?.message).toBe('Choisissez exactement 3 valeurs');
  });

  it('refuse une couleur à la fois préférée et à éviter', () => {
    expect(brandBriefSchema.safeParse({ ...aicha, avoidedColors: ['orange'] }).success).toBe(false);
  });
});

describe('palettes (RG-20, RG-22, §8.1 étape 3)', () => {
  it('propose 3 palettes, une par harmonie', () => {
    const palettes = generatePalettes(aicha, 1);
    expect(palettes).toHaveLength(3);
    expect(new Set(palettes.map((p) => p.harmony))).toEqual(new Set(['complementaire', 'analogue', 'triadique']));
  });

  it('respecte les rôles et le contraste pour 300 questionnaires variés', () => {
    let i = 0;
    for (const brief of randomBriefs(300)) {
      for (const palette of generatePalettes(brief, i++)) {
        expect(palette.colors.map((c) => c.role)).toEqual([...PALETTE_ROLES]);
        for (const color of palette.colors) {
          expect(color.cmyk).toHaveLength(4);
          expect(color.rgb).toHaveLength(3);
        }
        expect(checkPalette(palette)).toEqual([]);
      }
    }
  });

  it('n’utilise aucune couleur à éviter pour les couleurs de marque', () => {
    let i = 0;
    for (const brief of randomBriefs(300)) {
      const avoided = new Set(brief.avoidedColors);
      for (const palette of generatePalettes(brief, i++)) {
        for (const role of ['primary', 'secondary', 'accent'] as const) {
          const family = colorFamilyOf(paletteColor(palette, role));
          expect(family === null || !avoided.has(family), `${role} ${paletteColor(palette, role)} ∈ ${family}`).toBe(true);
        }
      }
    }
  });

  it('part de la couleur préférée', () => {
    const [palette] = generatePalettes({ ...aicha, preferredColors: ['bleu'] }, 7);
    expect(colorFamilyOf(paletteColor(palette!, 'primary'))).toBe('bleu');
  });

  it('avertit si le texte est illisible sur le fond', () => {
    const [palette] = generatePalettes(aicha, 1);
    const unreadable = {
      colors: palette!.colors.map((c) => (c.role === 'text' ? { ...c, hex: '#dddddd' } : c)),
    };
    expect(checkPalette(unreadable).map((w) => w.code)).toContain('TEXT_CONTRAST');
  });
});

describe('composition des logos (§8.1)', () => {
  const seed = generationSeed(aicha, 0);
  const creative = ruleBasedCreativeBrief(aicha, seed);
  const proposals = composeLogoProposals(aicha, creative, generatePalettes(aicha, seed), seed);

  it('produit une fiche créative valide (format imposé au futur modèle de langage)', () => {
    expect(creativeBriefSchema.safeParse(creative).success).toBe(true);
  });

  it('propose 6 logos valides et tous différents (US-21)', () => {
    expect(proposals).toHaveLength(6);
    for (const p of proposals) expect(logoSpecSchema.safeParse(p).success).toBe(true);
    const combos = proposals.map((p) => `${p.layout}|${p.iconId}|${p.font}`);
    expect(new Set(combos).size).toBe(6);
    const icons = proposals.map((p) => p.iconId).filter(Boolean);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('choisit des symboles du métier pour la première direction', () => {
    const businessIcon = ICONS.find((i) => i.id === proposals[0]!.iconId);
    expect(businessIcon?.sectors).toContain('restauration');
  });

  it('est reproductible, et « autres propositions » change le résultat', () => {
    const again = composeLogoProposals(aicha, creative, generatePalettes(aicha, seed), seed);
    expect(again).toEqual(proposals);
    const seed2 = generationSeed(aicha, 1);
    const other = composeLogoProposals(aicha, ruleBasedCreativeBrief(aicha, seed2), generatePalettes(aicha, seed2), seed2);
    expect(other).not.toEqual(proposals);
  });

  it('reste valide pour 300 questionnaires variés', () => {
    let i = 0;
    for (const brief of randomBriefs(300)) {
      const s = i++;
      const list = composeLogoProposals(brief, ruleBasedCreativeBrief(brief, s), generatePalettes(brief, s), s);
      expect(list).toHaveLength(6);
      for (const p of list) {
        expect(logoSpecSchema.safeParse(p).success).toBe(true);
        expect(contrastRatio(p.colors.icon, '#ffffff')).toBeGreaterThanOrEqual(2.5);
      }
    }
  });
});

describe('rendu SVG et variantes (US-24, RG-23)', () => {
  const [spec] = composeLogoProposals(aicha, ruleBasedCreativeBrief(aicha, 3), generatePalettes(aicha, 3), 3);

  it('produit un SVG vectoriel pour chaque variante', () => {
    for (const variant of LOGO_VARIANTS) {
      const { svg, width, height } = renderLogoSvg(spec!, variant);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).not.toMatch(/<image|data:image/);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    }
  });

  it('rend la variante monochrome entièrement en noir', () => {
    const { svg } = renderLogoSvg(spec!, 'monochrome');
    const colors = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1]));
    expect([...colors].every((c) => c === '#000000' || c === '#ffffff')).toBe(true);
  });

  it('échappe le texte saisi (pas d’injection de balises)', () => {
    const evil = { ...spec!, name: '<script>alert(1)</script>', slogan: '" onload="alert(1)' };
    const { svg } = renderLogoSvg(evil);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('" onload="');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('calcule les initiales du monogramme', () => {
    expect(initials('Chez Aïcha')).toBe('A');
    expect(initials('Agossou BTP')).toBe('AB');
    expect(initials('Institut Lumière de Parakou')).toBe('IL');
  });
});

describe('catalogues (RG-24, §9.3)', () => {
  it('n’a que des icônes et polices uniques', () => {
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length);
    expect(new Set(FONTS.map((f) => f.family)).size).toBe(FONTS.length);
  });

  it('a des icônes pour chaque secteur et des polices pour chaque style', () => {
    for (const sector of SECTORS) expect(ICONS.some((i) => i.sectors.includes(sector))).toBe(true);
    for (const style of VISUAL_STYLES) {
      expect(FONTS.filter((f) => f.role === 'heading' && f.styles.includes(style)).length).toBeGreaterThanOrEqual(2);
    }
  });
});
