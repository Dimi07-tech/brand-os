// Couleurs — RG-21 (HEX, RGB, CMJN) et RG-22 (contraste WCAG).

export type Rgb = [number, number, number];
export type Cmyk = [number, number, number, number];

export interface ColorValue {
  hex: string;
  rgb: Rgb;
  /** Conversion naïve sans profil ICC : indicative, à valider avec l'imprimeur. */
  cmyk: Cmyk;
}

export const HEX_PATTERN = /^#[0-9a-f]{6}$/;

export function normalizeHex(hex: string): string {
  const value = hex.trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = /^#?([0-9a-f]{6})$/.exec(value);
  if (!long) throw new Error(`Couleur invalide : ${hex}`);
  return `#${long[1]}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

/** Teinte en degrés [0, 360), saturation et luminosité en pourcentage [0, 100]. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

export function rgbToCmyk([r, g, b]: Rgb): Cmyk {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return [0, 0, 0, 100];
  const pct = (c: number) => Math.round(((1 - c - k) / (1 - k)) * 100);
  return [pct(rr), pct(gg), pct(bb), Math.round(k * 100)];
}

export function toColorValue(hex: string): ColorValue {
  const normalized = normalizeHex(hex);
  const rgb = hexToRgb(normalized);
  return { hex: normalized, rgb, cmyk: rgbToCmyk(rgb) };
}

/** Luminance relative WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** RG-22 : texte courant lisible si le contraste atteint 4,5:1 (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;
/** Éléments graphiques et grands titres : 3:1 (WCAG AA). */
export const MIN_GRAPHIC_CONTRAST = 3;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
