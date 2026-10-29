// Polices proposées — RG-24 : uniquement des polices à licence commerciale libre
// (Google Fonts, licence SIL Open Font License).
import type { VisualStyle } from './brief.js';

export interface FontDefinition {
  family: string;
  role: 'heading' | 'body';
  weight: number;
  styles: readonly VisualStyle[];
  /** Largeur moyenne d'un caractère en em, pour la mise en page avant export vectorisé. */
  charWidth: number;
  /** Repli si la police n'est pas chargée. */
  fallback: 'sans-serif' | 'serif' | 'cursive';
  uppercase?: boolean;
}

export const FONTS: readonly FontDefinition[] = [
  // Titres
  { family: 'Montserrat', role: 'heading', weight: 700, styles: ['moderne'], charWidth: 0.64, fallback: 'sans-serif' },
  { family: 'Poppins', role: 'heading', weight: 600, styles: ['moderne', 'ludique'], charWidth: 0.62, fallback: 'sans-serif' },
  { family: 'Space Grotesk', role: 'heading', weight: 700, styles: ['moderne'], charWidth: 0.58, fallback: 'sans-serif' },
  { family: 'Raleway', role: 'heading', weight: 700, styles: ['moderne', 'elegant'], charWidth: 0.58, fallback: 'sans-serif' },
  { family: 'Playfair Display', role: 'heading', weight: 700, styles: ['elegant', 'classique'], charWidth: 0.56, fallback: 'serif' },
  { family: 'DM Serif Display', role: 'heading', weight: 400, styles: ['elegant'], charWidth: 0.54, fallback: 'serif' },
  { family: 'Cormorant Garamond', role: 'heading', weight: 600, styles: ['elegant', 'classique'], charWidth: 0.47, fallback: 'serif' },
  { family: 'Fraunces', role: 'heading', weight: 600, styles: ['elegant', 'naturel'], charWidth: 0.57, fallback: 'serif' },
  { family: 'Bebas Neue', role: 'heading', weight: 400, styles: ['audacieux'], charWidth: 0.42, fallback: 'sans-serif', uppercase: true },
  { family: 'Archivo Black', role: 'heading', weight: 400, styles: ['audacieux'], charWidth: 0.7, fallback: 'sans-serif' },
  { family: 'Oswald', role: 'heading', weight: 600, styles: ['audacieux', 'moderne'], charWidth: 0.47, fallback: 'sans-serif', uppercase: true },
  { family: 'Anton', role: 'heading', weight: 400, styles: ['audacieux'], charWidth: 0.47, fallback: 'sans-serif', uppercase: true },
  { family: 'Fredoka', role: 'heading', weight: 600, styles: ['ludique'], charWidth: 0.58, fallback: 'sans-serif' },
  { family: 'Baloo 2', role: 'heading', weight: 700, styles: ['ludique'], charWidth: 0.57, fallback: 'sans-serif' },
  { family: 'Nunito', role: 'heading', weight: 800, styles: ['ludique', 'naturel'], charWidth: 0.58, fallback: 'sans-serif' },
  { family: 'Pacifico', role: 'heading', weight: 400, styles: ['ludique'], charWidth: 0.62, fallback: 'cursive' },
  { family: 'Lora', role: 'heading', weight: 700, styles: ['classique', 'naturel'], charWidth: 0.57, fallback: 'serif' },
  { family: 'Merriweather', role: 'heading', weight: 700, styles: ['classique'], charWidth: 0.62, fallback: 'serif' },
  { family: 'Libre Baskerville', role: 'heading', weight: 700, styles: ['classique', 'elegant'], charWidth: 0.64, fallback: 'serif' },
  { family: 'Josefin Sans', role: 'heading', weight: 600, styles: ['naturel', 'elegant'], charWidth: 0.56, fallback: 'sans-serif' },
  { family: 'Quicksand', role: 'heading', weight: 700, styles: ['naturel', 'ludique'], charWidth: 0.57, fallback: 'sans-serif' },
  { family: 'Comfortaa', role: 'heading', weight: 700, styles: ['naturel', 'ludique'], charWidth: 0.62, fallback: 'sans-serif' },
  // Texte courant
  { family: 'Inter', role: 'body', weight: 400, styles: ['moderne', 'audacieux'], charWidth: 0.55, fallback: 'sans-serif' },
  { family: 'Open Sans', role: 'body', weight: 400, styles: ['moderne', 'naturel'], charWidth: 0.55, fallback: 'sans-serif' },
  { family: 'Lato', role: 'body', weight: 400, styles: ['elegant', 'classique'], charWidth: 0.52, fallback: 'sans-serif' },
  { family: 'Source Sans 3', role: 'body', weight: 400, styles: ['classique', 'moderne'], charWidth: 0.5, fallback: 'sans-serif' },
  { family: 'Nunito Sans', role: 'body', weight: 400, styles: ['ludique', 'naturel'], charWidth: 0.54, fallback: 'sans-serif' },
  { family: 'Work Sans', role: 'body', weight: 400, styles: ['audacieux', 'moderne'], charWidth: 0.56, fallback: 'sans-serif' },
  { family: 'DM Sans', role: 'body', weight: 400, styles: ['ludique', 'elegant'], charWidth: 0.54, fallback: 'sans-serif' },
];

export const HEADING_FONTS = FONTS.filter((f) => f.role === 'heading');
export const BODY_FONTS = FONTS.filter((f) => f.role === 'body');

const BY_FAMILY = new Map(FONTS.map((f) => [f.family, f]));

export function getFont(family: string): FontDefinition | undefined {
  return BY_FAMILY.get(family);
}

export function isAllowedFont(family: string, role?: FontDefinition['role']): boolean {
  const font = BY_FAMILY.get(family);
  return font !== undefined && (role === undefined || font.role === role);
}

/** Graisses utilisées : titre (logo) et 400 (slogan) ; 400 et 600 pour le texte courant. */
export function fontWeights(font: FontDefinition): number[] {
  return font.role === 'body' ? [400, 600] : [...new Set([400, font.weight])].sort((a, b) => a - b);
}

/** Feuille de style Google Fonts pour afficher les aperçus (graisses utilisées seulement). */
export function googleFontsCssUrl(families: readonly string[]): string {
  const params = families
    .map((family) => getFont(family))
    .filter((f): f is FontDefinition => f !== undefined)
    .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${fontWeights(f).join(';')}`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
