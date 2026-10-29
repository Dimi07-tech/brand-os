import { z } from 'zod';
import type { Sector } from '../schemas/organization.js';
import { COLOR_FAMILY_INFO, type BrandBrief, type ColorFamily, type VisualStyle } from './brief.js';
import {
  contrastRatio,
  hexToHsl,
  hslToHex,
  HEX_PATTERN,
  MIN_GRAPHIC_CONTRAST,
  MIN_TEXT_CONTRAST,
  normalizeHex,
  toColorValue,
  type ColorValue,
} from './color.js';
import { createRandom, shuffle } from './random.js';

// Palettes — RG-20 (rôles minimum), RG-21 (HEX, RGB, CMJN), RG-22 (contraste),
// génération par règles d'harmonie (§8.1, étape 3).

export const PALETTE_ROLES = ['primary', 'secondary', 'accent', 'background', 'text'] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export const PALETTE_ROLE_LABELS: Record<PaletteRole, string> = {
  primary: 'Principale',
  secondary: 'Secondaire',
  accent: 'Accent',
  background: 'Fond',
  text: 'Texte',
};

export const HARMONIES = ['complementaire', 'analogue', 'triadique'] as const;
export type Harmony = (typeof HARMONIES)[number];

export const HARMONY_LABELS: Record<Harmony, string> = {
  complementaire: 'Complémentaire',
  analogue: 'Analogue',
  triadique: 'Triadique',
};

/** Palette envoyée par le client : rôles et HEX ; RGB et CMJN sont calculés par le serveur. */
export const paletteInputSchema = z.object({
  harmony: z.enum(HARMONIES).optional(),
  colors: z
    .array(
      z.object({
        role: z.enum(PALETTE_ROLES),
        hex: z
          .string()
          .trim()
          .toLowerCase()
          .regex(HEX_PATTERN, 'Couleur au format #rrggbb attendue'),
      }),
    )
    .refine(
      (colors) => PALETTE_ROLES.every((role) => colors.filter((c) => c.role === role).length === 1),
      'La palette doit contenir exactement une couleur principale, secondaire, accent, fond et texte',
    ),
});
export type PaletteInput = z.infer<typeof paletteInputSchema>;

export interface PaletteColor extends ColorValue {
  role: PaletteRole;
}

export interface Palette {
  harmony?: Harmony;
  colors: PaletteColor[];
}

export function completePalette(input: PaletteInput): Palette {
  return {
    harmony: input.harmony,
    colors: PALETTE_ROLES.map((role) => {
      const color = input.colors.find((c) => c.role === role)!;
      return { role, ...toColorValue(color.hex) };
    }),
  };
}

export function paletteColor(palette: Pick<Palette, 'colors'>, role: PaletteRole): string {
  const color = palette.colors.find((c) => c.role === role);
  if (!color) throw new Error(`Rôle absent de la palette : ${role}`);
  return color.hex;
}

export interface PaletteWarning {
  code: 'TEXT_CONTRAST' | 'PRIMARY_CONTRAST';
  ratio: number;
  message: string;
}

/** RG-22 : avertissements de contraste (n'empêchent pas l'enregistrement). */
export function checkPalette(palette: Pick<Palette, 'colors'>): PaletteWarning[] {
  const warnings: PaletteWarning[] = [];
  const background = paletteColor(palette, 'background');
  const text = contrastRatio(paletteColor(palette, 'text'), background);
  if (text < MIN_TEXT_CONTRAST) {
    warnings.push({
      code: 'TEXT_CONTRAST',
      ratio: round(text),
      message: `Contraste texte/fond de ${formatRatio(text)} : le minimum recommandé est 4,5:1. Le texte sera difficile à lire.`,
    });
  }
  const primary = contrastRatio(paletteColor(palette, 'primary'), background);
  if (primary < MIN_GRAPHIC_CONTRAST) {
    warnings.push({
      code: 'PRIMARY_CONTRAST',
      ratio: round(primary),
      message: `Contraste couleur principale/fond de ${formatRatio(primary)} : le minimum recommandé est 3:1 pour les titres et logos.`,
    });
  }
  return warnings;
}

// --- Génération ------------------------------------------------------------

/** Teintes par défaut quand l'utilisateur n'a pas de préférence. */
const SECTOR_COLORS: Record<Sector, ColorFamily[]> = {
  restauration: ['orange', 'rouge', 'vert'],
  'beaute-mode': ['rose', 'violet', 'turquoise'],
  commerce: ['bleu', 'orange', 'vert'],
  btp: ['jaune', 'orange', 'bleu'],
  'services-entreprises': ['bleu', 'turquoise', 'violet'],
  education: ['bleu', 'vert', 'orange'],
  evenementiel: ['violet', 'rose', 'jaune'],
  autre: ['bleu', 'vert', 'orange'],
};

/** Saturation et luminosité de la couleur principale selon le style visuel. */
const STYLE_TONE: Record<VisualStyle, { s: number; l: number }> = {
  moderne: { s: 70, l: 42 },
  elegant: { s: 38, l: 30 },
  audacieux: { s: 88, l: 46 },
  ludique: { s: 78, l: 50 },
  classique: { s: 50, l: 30 },
  naturel: { s: 42, l: 36 },
};

const CHROMATIC: ColorFamily[] = ['rouge', 'orange', 'jaune', 'vert', 'turquoise', 'bleu', 'violet', 'rose'];

/** Famille à laquelle appartient une couleur (pour respecter les couleurs à éviter). */
export function colorFamilyOf(hex: string): ColorFamily | null {
  const [h, s, l] = hexToHsl(hex);
  if (l < 14) return 'noir';
  if (s < 18) return null; // gris
  if (h >= 12 && h <= 45 && l < 32) return 'marron';
  let best: ColorFamily = 'rouge';
  let bestDistance = 360;
  for (const family of CHROMATIC) {
    const distance = hueDistance(h, COLOR_FAMILY_INFO[family].hue);
    if (distance < bestDistance) {
      best = family;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Trois palettes, une par règle d'harmonie, respectant RG-20 et RG-22, et les
 * couleurs préférées et à éviter du questionnaire.
 */
export function generatePalettes(
  brief: Pick<BrandBrief, 'sector' | 'style' | 'preferredColors' | 'avoidedColors'>,
  seed: number,
): Palette[] {
  const random = createRandom(seed);
  const avoided = new Set(brief.avoidedColors);
  const tone = STYLE_TONE[brief.style];

  const preferred = brief.preferredColors.filter((c) => !avoided.has(c));
  let bases: ColorFamily[] = preferred.filter((c) => c !== 'noir');
  if (bases.length === 0) bases = SECTOR_COLORS[brief.sector].filter((c) => !avoided.has(c));
  if (bases.length === 0) bases = CHROMATIC.filter((c) => !avoided.has(c));
  if (bases.length === 0) bases = ['bleu'];
  const wantsBlack = preferred.includes('noir');

  const harmonies = shuffle(random, HARMONIES);
  const offset = Math.floor(random() * bases.length);

  return harmonies.map((harmony, i) => {
    const family = bases[(i + offset) % bases.length]!;
    const jitter = (random() - 0.5) * 16;
    const [hue, sat, light] =
      family === 'marron' ? [28 + jitter / 2, 45, 27] : [COLOR_FAMILY_INFO[family].hue + jitter, tone.s, tone.l];

    const background = hslToHex(hue, 30, 97);
    const text = hslToHex(hue, 25, 12);
    const color = (h: number, s: number, l: number) => avoidFamilies(h, s, l, avoided);

    const primary = ensureContrast(color(hue, sat, light), background, MIN_GRAPHIC_CONTRAST);
    const [secondaryHue, accentHue] = (
      {
        complementaire: [hue + 180, hue + 30],
        analogue: [hue + 32, hue - 32],
        triadique: [hue + 120, hue + 240],
      } satisfies Record<Harmony, [number, number]>
    )[harmony];
    let secondary = ensureContrast(color(secondaryHue, sat * 0.85, light + 4), background, MIN_GRAPHIC_CONTRAST);
    if (wantsBlack && !avoided.has('noir')) secondary = hslToHex(hue, 8, 11);
    const accent = color(accentHue, Math.min(sat + 10, 95), 55);

    return completePalette({
      harmony,
      colors: [
        { role: 'primary', hex: primary },
        { role: 'secondary', hex: secondary },
        { role: 'accent', hex: accent },
        { role: 'background', hex: background },
        { role: 'text', hex: text },
      ],
    });
  });
}

/** Décale la teinte tant qu'elle tombe dans une famille à éviter. */
function avoidFamilies(h: number, s: number, l: number, avoided: Set<ColorFamily>): string {
  let hex = hslToHex(h, s, l);
  for (let i = 0; i < 15 && isAvoided(hex, avoided); i++) {
    hex = hslToHex(h + 24 * (i + 1), s, l);
  }
  return hex;
}

function isAvoided(hex: string, avoided: Set<ColorFamily>): boolean {
  const family = colorFamilyOf(hex);
  return family !== null && avoided.has(family);
}

/** Assombrit la couleur jusqu'à atteindre le contraste minimal sur le fond. */
function ensureContrast(hex: string, background: string, min: number): string {
  const [h, s] = hexToHsl(hex);
  let l = hexToHsl(hex)[2];
  let result = normalizeHex(hex);
  while (contrastRatio(result, background) < min && l > 5) {
    l -= 3;
    result = hslToHex(h, s, l);
  }
  return result;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatRatio(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}:1`;
}
