import qrcode from 'qrcode-generator';
import { z } from 'zod';

// Cartes de visite — §4.7 (US-50, US-51, US-53), RG-50 :
// 85 x 55 mm, fond perdu de 3 mm, zone de sécurité de 3 mm, CMJN, 300 dpi
// (rendu vectoriel : la résolution ne dépend pas de la taille d'impression).

export const CARD = {
  width: 85,
  height: 55,
  bleed: 3,
  safe: 3,
} as const;

/** Format du document d'impression, fond perdu compris : 91 x 61 mm. */
export const CARD_WITH_BLEED = { width: CARD.width + 2 * CARD.bleed, height: CARD.height + 2 * CARD.bleed } as const;

export const QR_TARGETS = ['whatsapp', 'website', 'none'] as const;
export type QrTarget = (typeof QR_TARGETS)[number];

const optionalLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum`)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

export const businessCardFieldsSchema = z.object({
  fullName: z.string().trim().min(1, 'Indiquez le nom').max(60, '60 caractères au maximum'),
  jobTitle: optionalLine(60),
  phone: optionalLine(30),
  whatsapp: optionalLine(30),
  email: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? undefined : v.toLowerCase()))
    .optional()
    .refine((v) => v === undefined || z.email().safeParse(v).success, 'Adresse e-mail invalide'),
  website: optionalLine(80),
  address: optionalLine(120),
});
export type BusinessCardFields = z.infer<typeof businessCardFieldsSchema>;

/**
 * Numéro WhatsApp international, sans « + » ni espaces. Au Bénin, les numéros
 * à 10 chiffres commencent par 01 depuis 2024 ; les anciens numéros à 8 chiffres
 * prennent le préfixe 01.
 */
export function whatsappNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 8) digits = `22901${digits}`;
  else if (digits.length === 10 && digits.startsWith('01')) digits = `229${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function websiteUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/** Adresse encodée dans le QR code, ou null si elle ne peut pas être construite. */
export function qrContent(fields: BusinessCardFields, target: QrTarget): string | null {
  if (target === 'whatsapp') {
    const number = whatsappNumber(fields.whatsapp ?? fields.phone ?? '');
    return number ? `https://wa.me/${number}` : null;
  }
  if (target === 'website' && fields.website) return websiteUrl(fields.website);
  return null;
}

/**
 * QR code vectoriel : un seul tracé SVG, une unité par module, marge de 2 modules.
 * Correction d'erreur M (15 %) : lisible même légèrement abîmé.
 */
export function qrPath(content: string): { d: string; size: number } {
  const qr = qrcode(0, 'M');
  qr.addData(content, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const margin = 2;
  const parts: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) parts.push(`M${col + margin} ${row + margin}h1v1h-1z`);
    }
  }
  return { d: parts.join(''), size: count + 2 * margin };
}
