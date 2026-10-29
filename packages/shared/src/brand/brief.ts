import { z } from 'zod';
import { SECTORS } from '../schemas/organization.js';

// Questionnaire créatif en 6 étapes — US-20, §4.3 :
// 1) nom et slogan, 2) secteur, 3) cible, 4) 3 valeurs, 5) style visuel,
// 6) couleurs préférées et à éviter.

export const AUDIENCES = [
  'particuliers',
  'familles',
  'jeunes',
  'professionnels',
  'haut-de-gamme',
  'grand-public',
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  particuliers: 'Particuliers',
  familles: 'Familles',
  jeunes: 'Jeunes',
  professionnels: 'Entreprises et professionnels',
  'haut-de-gamme': 'Clientèle haut de gamme',
  'grand-public': 'Grand public',
};

export const BRAND_VALUES = [
  'qualite',
  'fiabilite',
  'proximite',
  'innovation',
  'tradition',
  'elegance',
  'rapidite',
  'creativite',
  'convivialite',
  'excellence',
  'simplicite',
  'authenticite',
  'durabilite',
  'audace',
  'securite',
] as const;
export type BrandValue = (typeof BRAND_VALUES)[number];

export const BRAND_VALUE_LABELS: Record<BrandValue, string> = {
  qualite: 'Qualité',
  fiabilite: 'Fiabilité',
  proximite: 'Proximité',
  innovation: 'Innovation',
  tradition: 'Tradition',
  elegance: 'Élégance',
  rapidite: 'Rapidité',
  creativite: 'Créativité',
  convivialite: 'Convivialité',
  excellence: 'Excellence',
  simplicite: 'Simplicité',
  authenticite: 'Authenticité',
  durabilite: 'Durabilité',
  audace: 'Audace',
  securite: 'Sécurité',
};

export const VISUAL_STYLES = ['moderne', 'elegant', 'audacieux', 'ludique', 'classique', 'naturel'] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const VISUAL_STYLE_LABELS: Record<VisualStyle, { label: string; description: string }> = {
  moderne: { label: 'Moderne', description: 'Net, épuré, actuel' },
  elegant: { label: 'Élégant', description: 'Raffiné, sobre, haut de gamme' },
  audacieux: { label: 'Audacieux', description: 'Fort, percutant, qui se remarque' },
  ludique: { label: 'Ludique', description: 'Chaleureux, rond, accessible' },
  classique: { label: 'Classique', description: 'Sérieux, établi, rassurant' },
  naturel: { label: 'Naturel', description: 'Doux, authentique, organique' },
};

export const COLOR_FAMILIES = [
  'rouge',
  'orange',
  'jaune',
  'vert',
  'turquoise',
  'bleu',
  'violet',
  'rose',
  'marron',
  'noir',
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** Teinte de référence (HSL) et échantillon d'affichage de chaque famille. */
export const COLOR_FAMILY_INFO: Record<ColorFamily, { label: string; hue: number; swatch: string; chromatic: boolean }> = {
  rouge: { label: 'Rouge', hue: 0, swatch: '#dc2626', chromatic: true },
  orange: { label: 'Orange', hue: 25, swatch: '#ea580c', chromatic: true },
  jaune: { label: 'Jaune', hue: 45, swatch: '#eab308', chromatic: true },
  vert: { label: 'Vert', hue: 140, swatch: '#16a34a', chromatic: true },
  turquoise: { label: 'Turquoise', hue: 178, swatch: '#0d9488', chromatic: true },
  bleu: { label: 'Bleu', hue: 215, swatch: '#2563eb', chromatic: true },
  violet: { label: 'Violet', hue: 268, swatch: '#7c3aed', chromatic: true },
  rose: { label: 'Rose', hue: 330, swatch: '#db2777', chromatic: true },
  marron: { label: 'Marron', hue: 25, swatch: '#78350f', chromatic: false },
  noir: { label: 'Noir', hue: 0, swatch: '#1c1917', chromatic: false },
};

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((list) => new Set(list).size === list.length, 'Choix en double');

export const brandBriefSchema = z
  .object({
    name: z.string().trim().min(1, 'Indiquez le nom de votre marque').max(40, '40 caractères au maximum'),
    slogan: z
      .string()
      .trim()
      .max(80, '80 caractères au maximum')
      .transform((v) => (v === '' ? undefined : v))
      .optional(),
    sector: z.enum(SECTORS, 'Choisissez un secteur'),
    audience: uniqueList(z.enum(AUDIENCES)).min(1, 'Choisissez au moins une cible').max(3, '3 cibles au maximum'),
    values: uniqueList(z.enum(BRAND_VALUES)).length(3, 'Choisissez exactement 3 valeurs'),
    style: z.enum(VISUAL_STYLES, 'Choisissez un style'),
    preferredColors: uniqueList(z.enum(COLOR_FAMILIES)).max(3, '3 couleurs au maximum'),
    avoidedColors: uniqueList(z.enum(COLOR_FAMILIES)).max(5, '5 couleurs au maximum'),
  })
  .refine((b) => !b.preferredColors.some((c) => b.avoidedColors.includes(c)), {
    message: 'Une couleur ne peut pas être à la fois préférée et à éviter',
    path: ['avoidedColors'],
  });
export type BrandBrief = z.infer<typeof brandBriefSchema>;
