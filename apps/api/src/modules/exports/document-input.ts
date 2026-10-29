import { NotFoundException } from '@nestjs/common';
import type { TenantTx } from '@brand-os/db';
import { logoSpecSchema, type DocumentLine } from '@brand-os/shared';
import type { DocumentBrand, DocumentInput, DocumentParty } from './document-template.js';

/**
 * Données d'impression d'un document. Émis : uniquement ses instantanés figés
 * (RG-31, RG-63 : un changement de marque ou de client ne le modifie jamais).
 * Brouillon : données actuelles de l'entreprise, du client et de la marque.
 */
export async function loadDocumentInput(tx: TenantTx, documentId: string): Promise<DocumentInput & { brandId: string | null }> {
  const document = await tx.businessDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new NotFoundException('Document introuvable.');
  const corrects = document.correctsId
    ? (await tx.businessDocument.findUnique({ where: { id: document.correctsId }, select: { number: true } }))?.number
    : null;
  const base = {
    type: document.type,
    number: document.number,
    issuedAt: document.issuedAt,
    dueAt: document.dueAt,
    currency: document.currency,
    lines: document.lines as unknown as DocumentLine[],
    paymentTerms: document.paymentTerms,
    notes: document.notes,
    corrects,
  };

  if (document.status !== 'DRAFT') {
    const issuer = document.issuerSnapshot as unknown as DocumentParty & { vatEnabled: boolean };
    const brand = document.brandSnapshot as unknown as DocumentBrand | null;
    return { ...base, issuer, vatEnabled: issuer.vatEnabled, client: document.clientSnapshot as unknown as DocumentParty | null, brand, brandId: null };
  }

  const organization = await tx.organization.findUniqueOrThrow({ where: { id: document.organizationId } });
  const client = document.clientId ? await tx.client.findUnique({ where: { id: document.clientId } }) : null;
  const brand = await tx.brand.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { palettes: { where: { isActive: true }, take: 1 }, typographies: { where: { isActive: true }, take: 1 } },
  });
  const logo = logoSpecSchema.safeParse(brand?.logo);
  return {
    ...base,
    issuer: organization,
    vatEnabled: organization.vatEnabled,
    client,
    brand:
      brand && logo.success && brand.palettes[0] && brand.typographies[0]
        ? {
            logo: logo.data,
            colors: brand.palettes[0].colors as unknown as DocumentBrand['colors'],
            typography: { heading: brand.typographies[0].headingFont, body: brand.typographies[0].bodyFont },
          }
        : null,
    brandId: brand?.id ?? null,
  };
}
