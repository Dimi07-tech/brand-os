import { z } from 'zod';

// Organisations — §4.2 (US-10, US-11)

/** Secteurs prioritaires au Bénin (§2.1), utilisés aussi pour filtrer les modèles. */
export const SECTORS = [
  'restauration',
  'beaute-mode',
  'commerce',
  'btp',
  'services-entreprises',
  'education',
  'evenementiel',
  'autre',
] as const;
export type Sector = (typeof SECTORS)[number];

export const CURRENCIES = ['XOF', 'EUR', 'USD'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

// Champs sans valeur par défaut : la mise à jour partielle ne doit jamais
// réécrire un champ absent de la requête (ex. remettre la devise à XOF).
const organizationFields = {
  name: z.string().trim().min(2, 'Indiquez le nom commercial').max(120),
  sector: z.enum(SECTORS, 'Choisissez un secteur'),
  country: z.string().trim().length(2).toUpperCase(),
  city: optionalText(80),
  phone: optionalText(30),
  // Facultatif : un champ vide signifie « pas d'e-mail de contact ».
  email: optionalText(254)
    .transform((v) => v?.toLowerCase() ?? v)
    .refine((v) => v == null || z.email().safeParse(v).success, 'Adresse e-mail invalide'),
  currency: z.enum(CURRENCIES),
};

export const createOrganizationSchema = z.object({
  ...organizationFields,
  country: organizationFields.country.default('BJ'),
  currency: organizationFields.currency.default('XOF'),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z
  .object(organizationFields)
  .partial()
  .extend({
    address: optionalText(200),
    website: optionalText(200),
    // Registre du commerce, ex. « RB/COT/24 B 12345 »
    rccm: optionalText(40),
    // Identifiant fiscal unique béninois : 13 chiffres
    // (champ vide = effacé)
    ifu: optionalText(20).refine((v) => v == null || /^\d{13}$/.test(v), "L'IFU comporte 13 chiffres"),
    taxRegime: optionalText(60),
    vatEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification fournie');
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
