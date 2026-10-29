import { z } from 'zod';
import {
  AUDIENCE_LABELS,
  BRAND_VALUE_LABELS,
  VISUAL_STYLE_LABELS,
  type BrandBrief,
  type VisualStyle,
} from './brief.js';
import { HEADING_FONTS, getFont, isAllowedFont } from './fonts.js';
import { ICONS, isKnownIcon } from './icons.js';
import { ICON_CONTAINERS, LOGO_LAYOUTS, type IconContainer, type LogoLayout, type LogoSpec } from './logo.js';
import { paletteColor, type Palette } from './palette.js';
import { createRandom, hashString, pick, shuffle } from './random.js';

// Pipeline de génération d'un logo — §8.1 :
// 1) analyse du brief → fiche créative (règles aujourd'hui, modèle de langage demain) ;
// 2) choix des composants, 4) composition, 5) contrôle qualité, 6) 6 propositions.

/**
 * Fiche créative produite par l'analyse du brief. C'est aussi le format de sortie
 * imposé au modèle de langage : validé strictement avant usage (§8.5), il ne peut
 * référencer que des icônes et polices du catalogue.
 */
export const creativeBriefSchema = z.object({
  keywords: z.array(z.string().max(40)).max(10),
  mood: z.string().max(200),
  directions: z
    .array(
      z.object({
        title: z.string().max(60),
        rationale: z.string().max(300),
        iconIds: z.array(z.string().refine(isKnownIcon, 'Icône inconnue')).max(8),
        fonts: z.array(z.string().refine((f) => isAllowedFont(f, 'heading'), 'Police non autorisée')).min(1).max(4),
        layouts: z.array(z.enum(LOGO_LAYOUTS)).min(1).max(4),
        containers: z.array(z.enum(ICON_CONTAINERS)).min(1).max(3),
      }),
    )
    .length(3),
});
export type CreativeBrief = z.infer<typeof creativeBriefSchema>;

export const PROPOSAL_COUNT = 6;

/** Graine d'une génération : même brief + même tentative = mêmes propositions. */
export function generationSeed(brief: BrandBrief, attempt: number): number {
  return (hashString(JSON.stringify(brief)) ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
}

const NEIGHBOR_STYLES: Record<VisualStyle, VisualStyle> = {
  moderne: 'audacieux',
  elegant: 'classique',
  audacieux: 'moderne',
  ludique: 'naturel',
  classique: 'elegant',
  naturel: 'ludique',
};

const STYLE_CONTAINERS: Record<VisualStyle, IconContainer[]> = {
  moderne: ['none', 'rounded'],
  elegant: ['none', 'circle'],
  audacieux: ['rounded', 'none'],
  ludique: ['circle', 'rounded'],
  classique: ['none', 'circle'],
  naturel: ['circle', 'none'],
};

/** Étape 1 sans IA : fiche créative déduite du secteur, des valeurs et du style. */
export function ruleBasedCreativeBrief(brief: BrandBrief, seed: number): CreativeBrief {
  const random = createRandom(seed);

  const sectorIcons = ICONS.filter((i) => i.sectors.includes(brief.sector)).map((i) => i.id);
  const valueIcons = ICONS.filter((i) => !sectorIcons.includes(i.id))
    .map((i) => ({ id: i.id, score: i.values.filter((v) => brief.values.includes(v)).length + random() * 0.5 }))
    .filter((i) => i.score >= 1)
    .sort((a, b) => b.score - a.score)
    .map((i) => i.id);
  const fallbackIcons = ICONS.filter((i) => i.sectors.includes('autre')).map((i) => i.id);

  const styleFonts = HEADING_FONTS.filter((f) => f.styles.includes(brief.style)).map((f) => f.family);
  const neighborFonts = HEADING_FONTS.filter(
    (f) => f.styles.includes(NEIGHBOR_STYLES[brief.style]) && !styleFonts.includes(f.family),
  ).map((f) => f.family);
  const containers = STYLE_CONTAINERS[brief.style];

  const businessIcons = sectorIcons.length >= 2 ? sectorIcons : [...sectorIcons, ...fallbackIcons];
  const symbolicIcons = valueIcons.length >= 2 ? valueIcons : fallbackIcons;

  return {
    keywords: [
      brief.sector,
      ...brief.values.map((v) => BRAND_VALUE_LABELS[v]),
      VISUAL_STYLE_LABELS[brief.style].label,
      ...brief.audience.map((a) => AUDIENCE_LABELS[a]),
    ].slice(0, 10),
    mood: VISUAL_STYLE_LABELS[brief.style].description,
    directions: [
      {
        title: 'Votre métier',
        rationale: 'Un symbole qui dit immédiatement ce que vous faites.',
        iconIds: shuffle(random, businessIcons).slice(0, 6),
        fonts: shuffle(random, styleFonts).slice(0, 4),
        layouts: ['icon-left', 'icon-top'],
        containers: [containers[0]!, containers[1]!],
      },
      {
        title: 'Vos valeurs',
        rationale: `Un symbole qui évoque ${brief.values.map((v) => BRAND_VALUE_LABELS[v].toLowerCase()).join(', ')}.`,
        iconIds: symbolicIcons.slice(0, 6),
        fonts: shuffle(random, [...styleFonts, ...neighborFonts]).slice(0, 4),
        layouts: ['icon-top', 'icon-left'],
        containers: [containers[1]!, containers[0]!],
      },
      {
        title: 'Typographique',
        rationale: 'Votre nom au centre, pour une marque sobre et mémorable.',
        iconIds: [],
        fonts: shuffle(random, [...styleFonts, ...neighborFonts]).slice(0, 4),
        layouts: ['monogram', 'wordmark'],
        containers: [pick(random, ['circle', 'rounded'] as const)],
      },
    ],
  };
}

/**
 * Étapes 2 à 6 : compose 6 propositions variées (2 par direction créative),
 * chacune avec une palette différente, sans répéter une icône.
 */
export function composeLogoProposals(
  brief: BrandBrief,
  creative: CreativeBrief,
  palettes: readonly Palette[],
  seed: number,
): LogoSpec[] {
  if (palettes.length === 0) throw new Error('Aucune palette pour composer les logos');
  const random = createRandom(seed ^ 0x5bd1e995);
  const usedIcons = new Set<string>();
  const usedCombos = new Set<string>();
  const proposals: LogoSpec[] = [];
  const perDirection = PROPOSAL_COUNT / creative.directions.length;

  creative.directions.forEach((direction, d) => {
    for (let k = 0; k < perDirection; k++) {
      const index = proposals.length;
      const palette = palettes[index % palettes.length]!;
      let layout: LogoLayout = direction.layouts[k % direction.layouts.length]!;
      const freeIcons = direction.iconIds.filter((id) => !usedIcons.has(id));
      let iconId: string | null = null;
      if (layout === 'icon-left' || layout === 'icon-top') {
        iconId = freeIcons[0] ?? direction.iconIds[k % Math.max(direction.iconIds.length, 1)] ?? null;
        if (iconId === null) layout = 'monogram';
        else usedIcons.add(iconId);
      }

      let font = direction.fonts[(k + d) % direction.fonts.length]!;
      const combo = () => `${layout}|${iconId}|${font}`;
      for (let i = 0; usedCombos.has(combo()) && i < HEADING_FONTS.length; i++) {
        font = HEADING_FONTS[(HEADING_FONTS.findIndex((f) => f.family === font) + 1) % HEADING_FONTS.length]!.family;
      }
      usedCombos.add(combo());

      const fontDef = getFont(font);
      const uppercase = Boolean(fontDef?.uppercase) || (brief.style === 'audacieux' && random() < 0.5);
      const letterSpacing = brief.style === 'elegant' ? 0.08 : uppercase ? 0.04 : 0;

      proposals.push({
        schemaVersion: 1,
        name: brief.name,
        slogan: brief.slogan,
        layout,
        iconId,
        iconContainer: direction.containers[k % direction.containers.length]!,
        font,
        uppercase,
        letterSpacing,
        colors: {
          icon: paletteColor(palette, 'primary'),
          text: k % 2 === 0 ? paletteColor(palette, 'text') : paletteColor(palette, 'secondary'),
          slogan: paletteColor(palette, k % 2 === 0 ? 'secondary' : 'text'),
        },
      });
    }
  });

  return proposals;
}
