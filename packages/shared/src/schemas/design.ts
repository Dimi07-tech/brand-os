import { z } from 'zod';
import { businessCardFieldsSchema, QR_TARGETS } from '../cards/format.js';
import { getCardTemplate } from '../cards/render.js';

// Créations (Design) — §4.6, §4.7. Une carte de visite est une donnée : modèle,
// textes et QR code ; logo, couleurs et polices viennent du Brand Kit.

export const businessCardCompositionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('BUSINESS_CARD'),
  templateId: z.string().refine((id) => getCardTemplate(id) !== undefined, 'Modèle inconnu'),
  fields: businessCardFieldsSchema,
  qr: z.enum(QR_TARGETS),
});
export type BusinessCardComposition = z.infer<typeof businessCardCompositionSchema>;

export const createDesignSchema = z.object({
  brandId: z.uuid('Marque invalide'),
  name: z.string().trim().min(1).max(80).optional(),
  composition: businessCardCompositionSchema,
});
export type CreateDesignInput = z.infer<typeof createDesignSchema>;

/** RG-40 : la version connue du client évite d'écraser une modification faite ailleurs. */
export const updateDesignSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  composition: businessCardCompositionSchema,
  version: z.number().int().min(1),
});
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
