import { ConflictException, NotFoundException } from '@nestjs/common';
import type { TenantTx } from '@brand-os/db';
import {
  brandBriefSchema,
  defaultGuidelinesText,
  guidelinesTextSchema,
  logoSpecSchema,
  type GuidelinesText,
  type LogoSpec,
  type PaletteColor,
} from '@brand-os/shared';

/** Identité enregistrée d'une marque, prête à être exportée. */
export interface BrandSnapshot {
  id: string;
  name: string;
  slogan: string | null;
  version: number;
  logo: LogoSpec;
  colors: PaletteColor[];
  typography: { heading: string; body: string };
  texts: GuidelinesText;
  textsEdited: boolean;
  organization: { name: string; city: string | null; phone: string | null; email: string | null; website: string | null };
}

/** Charge la marque sous RLS ; 404 si elle n'appartient pas à l'organisation active. */
export async function loadBrandSnapshot(tx: TenantTx, brandId: string): Promise<BrandSnapshot> {
  const brand = await tx.brand.findUnique({
    where: { id: brandId },
    include: {
      palettes: { where: { isActive: true }, take: 1 },
      typographies: { where: { isActive: true }, take: 1 },
      organization: { select: { name: true, city: true, phone: true, email: true, website: true } },
    },
  });
  if (!brand) throw new NotFoundException('Marque introuvable.');
  const palette = brand.palettes[0];
  const typography = brand.typographies[0];
  const logo = logoSpecSchema.safeParse(brand.logo);
  if (!logo.success || !palette || !typography) {
    throw new ConflictException({
      code: 'BRAND_INCOMPLETE',
      message: 'Enregistrez d’abord votre marque (logo, couleurs et polices) dans le Brand Studio.',
    });
  }

  const saved = guidelinesTextSchema.safeParse(brand.guidelines);
  const brief = brandBriefSchema.safeParse(brand.brief);
  const texts = saved.success ? saved.data : brief.success ? defaultGuidelinesText(brief.data) : fallbackTexts(brand.name);

  return {
    id: brand.id,
    name: brand.name,
    slogan: brand.slogan,
    version: brand.activeVersionNum,
    logo: logo.data,
    colors: palette.colors as unknown as PaletteColor[],
    typography: { heading: typography.headingFont, body: typography.bodyFont },
    texts,
    textsEdited: saved.success,
    organization: brand.organization,
  };
}

function fallbackTexts(name: string): GuidelinesText {
  return defaultGuidelinesText({
    name,
    sector: 'autre',
    audience: ['grand-public'],
    values: ['qualite', 'fiabilite', 'proximite'],
    style: 'moderne',
    preferredColors: [],
    avoidedColors: [],
  });
}

/** Lettres des langues du Bénin sans décomposition Unicode (fon, yoruba…). */
const TRANSLITERATIONS: Record<string, string> = { Ɖ: 'D', ɖ: 'd', Ɔ: 'O', ɔ: 'o', Ɛ: 'E', ɛ: 'e', Ŋ: 'N', ŋ: 'n', Ƒ: 'F', ƒ: 'f' };

/** Nom de fichier sûr et lisible : « Chez Aïcha » → « chez-aicha », « Ɖokpo » → « dokpo ». */
export function slugify(value: string): string {
  return (
    value
      .replace(/[ƉɖƆɔƐɛŊŋƑƒ]/g, (c) => TRANSLITERATIONS[c]!)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'marque'
  );
}
