import { z } from 'zod';
import { isAllowedFont } from '../brand/fonts.js';
import { logoSpecSchema } from '../brand/logo.js';
import { paletteInputSchema } from '../brand/palette.js';

// Entrées de l'API Brand Studio — §4.3, §4.4

export const generateSchema = z.object({
  /** 0 pour la première série, puis +1 à chaque « autres propositions » (US-21). */
  attempt: z.number().int().min(0).max(1000).default(0),
});
export type GenerateInput = z.infer<typeof generateSchema>;

// RG-24 : polices de la liste sous licence libre uniquement
export const typographySchema = z.object({
  heading: z.string().refine((f) => isAllowedFont(f, 'heading'), 'Police de titre non autorisée'),
  body: z.string().refine((f) => isAllowedFont(f, 'body'), 'Police de texte non autorisée'),
});
export type TypographyInput = z.infer<typeof typographySchema>;

/** Identité validée par l'utilisateur : logo, palette et polices (US-22, US-25, US-26). */
export const brandIdentitySchema = z.object({
  logo: logoSpecSchema,
  palette: paletteInputSchema,
  typography: typographySchema,
});
export type BrandIdentityInput = z.infer<typeof brandIdentitySchema>;

// Exports — §4.4 (US-31), §4.5 (US-40)
export const EXPORT_TYPES = ['LOGO_PACK', 'GUIDELINES_PDF', 'BUSINESS_CARD_PDF', 'BUSINESS_DOCUMENT_PDF'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const createExportSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['LOGO_PACK', 'GUIDELINES_PDF']), brandId: z.uuid('Marque invalide') }),
  // US-53 : la carte est exportée à partir de sa création enregistrée
  z.object({ type: z.literal('BUSINESS_CARD_PDF'), designId: z.uuid('Création invalide') }),
  // Facture, devis ou avoir émis (§4.8)
  z.object({ type: z.literal('BUSINESS_DOCUMENT_PDF'), documentId: z.uuid('Document invalide') }),
]);
export type CreateExportInput = z.infer<typeof createExportSchema>;
