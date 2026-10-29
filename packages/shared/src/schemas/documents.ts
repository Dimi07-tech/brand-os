import { z } from 'zod';
import { DEFAULT_VAT_BPS } from '../documents/money.js';

// Factures, devis, clients et produits — §4.8 (US-60 à US-62, RG-60 à RG-64)

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum`)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

/** Montant maximal accepté : 1 000 milliards d'unités mineures. */
const MAX_AMOUNT = 1_000_000_000_000;

// US-62 : clients et produits réutilisables
export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'Indiquez le nom du client').max(120),
  email: text(120).refine((v) => v === undefined || z.email().safeParse(v).success, 'Adresse e-mail invalide'),
  phone: text(30),
  address: text(200),
  ifu: text(20).refine((v) => v === undefined || /^\d{13}$/.test(v), "L'IFU comporte 13 chiffres"),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

export const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Indiquez le nom du produit ou service').max(200),
  description: text(500),
  unit: text(20),
  unitPriceMinor: z.number().int('Prix invalide').min(0, 'Prix invalide').max(MAX_AMOUNT),
  vatRateBps: z.number().int().min(0).max(10_000).default(DEFAULT_VAT_BPS),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const documentLineSchema = z.object({
  label: z.string().trim().min(1, 'Indiquez la désignation').max(200, '200 caractères au maximum'),
  description: text(500),
  unit: text(20),
  quantityMilli: z.number().int().min(1, 'La quantité doit être positive').max(1_000_000_000),
  unitPriceMinor: z.number().int().min(0, 'Prix invalide').max(MAX_AMOUNT),
  discountBps: z.number().int().min(0).max(10_000).default(0),
  vatRateBps: z.number().int().min(0).max(10_000).default(DEFAULT_VAT_BPS),
});
export type DocumentLine = z.infer<typeof documentLineSchema>;

export const DOCUMENT_KINDS = ['INVOICE', 'QUOTE'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
  .refine((d) => !Number.isNaN(Date.parse(d)), 'Date invalide');

/** Brouillon (création et modification) : le client peut manquer, les lignes non. */
export const documentDraftSchema = z.object({
  clientId: z.uuid().nullish(),
  lines: z.array(documentLineSchema).min(1, 'Ajoutez au moins une ligne').max(100, '100 lignes au maximum'),
  dueDate: isoDate.nullish(),
  paymentTerms: text(300),
  notes: text(1000),
});
export type DocumentDraftInput = z.infer<typeof documentDraftSchema>;

export const createDocumentSchema = documentDraftSchema.extend({ type: z.enum(DOCUMENT_KINDS) });
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Numéro : FAC-2026-0001, DEV-2026-0001, AV-2026-0001 (RG-62). */
export const DOCUMENT_PREFIXES = { INVOICE: 'FAC', QUOTE: 'DEV', CREDIT_NOTE: 'AV' } as const;

export function formatDocumentNumber(type: keyof typeof DOCUMENT_PREFIXES, year: number, sequence: number): string {
  return `${DOCUMENT_PREFIXES[type]}-${year}-${String(sequence).padStart(4, '0')}`;
}
