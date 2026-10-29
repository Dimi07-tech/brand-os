import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { withTenant, type BusinessDocument, type BusinessDocumentType, type Prisma, type TenantTx } from '@brand-os/db';
import {
  computeTotals,
  formatDocumentNumber,
  logoSpecSchema,
  type CreateDocumentInput,
  type DocumentDraftInput,
  type DocumentKind,
  type DocumentLine,
} from '@brand-os/shared';
import type { TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsageService } from '../usage/usage.service.js';

/** Fuseau du Bénin : l'année de numérotation est celle de la date d'émission locale. */
const TIMEZONE = 'Africa/Porto-Novo';

const DEFAULT_TERMS: Record<DocumentKind, string> = {
  INVOICE: 'Paiement à 30 jours à compter de la date de la facture.',
  QUOTE: 'Devis valable 30 jours. Bon pour accord : date et signature du client.',
};

export interface IssuerSnapshot {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rccm: string | null;
  ifu: string | null;
  taxRegime: string | null;
  vatEnabled: boolean;
}

export interface ClientSnapshot {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ifu: string | null;
}

/** Factures, devis et avoirs — §4.8 (US-60, US-61, RG-60 à RG-64). */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  private tx<T>(tenant: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return withTenant(this.prisma.client, tenant, fn);
  }

  async list(tenant: TenantContext, filter: { type?: BusinessDocumentType; status?: string }) {
    const documents = await this.tx(tenant, (tx) =>
      tx.businessDocument.findMany({
        where: { ...(filter.type && { type: filter.type }) },
        include: { client: { select: { name: true } } },
        orderBy: [{ updatedAt: 'desc' }],
        take: 200,
      }),
    );
    return documents.map((d) => ({ ...summary(d), clientName: snapshotName(d) ?? d.client?.name ?? null }));
  }

  async get(tenant: TenantContext, id: string) {
    return this.tx(tenant, async (tx) => {
      const document = await find(tx, id);
      const client = document.clientId ? await tx.client.findUnique({ where: { id: document.clientId } }) : null;
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
      return view(document, client, organization);
    });
  }

  /** US-60, US-61 : brouillon ; les totaux sont calculés par le serveur (RG-60). */
  async create(tenant: TenantContext, input: CreateDocumentInput) {
    return this.tx(tenant, async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
      if (input.clientId) await findClient(tx, input.clientId);
      const totals = computeTotals(input.lines, { vatEnabled: organization.vatEnabled });
      const document = await tx.businessDocument.create({
        data: {
          organizationId: tenant.organizationId,
          type: input.type,
          clientId: input.clientId ?? null,
          currency: organization.currency,
          lines: input.lines as unknown as Prisma.InputJsonValue,
          ...amounts(totals),
          dueAt: input.dueDate ? new Date(input.dueDate) : null,
          paymentTerms: input.paymentTerms ?? DEFAULT_TERMS[input.type],
          notes: input.notes ?? null,
          createdById: tenant.userId,
        },
      });
      return this.getWith(tx, document.id, tenant);
    });
  }

  /** RG-63 : seul un brouillon est modifiable. */
  async update(tenant: TenantContext, id: string, input: DocumentDraftInput) {
    return this.tx(tenant, async (tx) => {
      const document = await lockDraft(tx, id);
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
      if (input.clientId) await findClient(tx, input.clientId);
      const totals = computeTotals(input.lines, { vatEnabled: organization.vatEnabled });
      await tx.businessDocument.update({
        where: { id: document.id },
        data: {
          clientId: input.clientId ?? null,
          lines: input.lines as unknown as Prisma.InputJsonValue,
          ...amounts(totals),
          dueAt: input.dueDate ? new Date(input.dueDate) : null,
          paymentTerms: input.paymentTerms ?? null,
          notes: input.notes ?? null,
        },
      });
      return this.getWith(tx, id, tenant);
    });
  }

  async remove(tenant: TenantContext, id: string): Promise<void> {
    await this.tx(tenant, async (tx) => {
      await lockDraft(tx, id);
      await tx.businessDocument.delete({ where: { id } });
    });
  }

  /**
   * Émission : numéro définitif, instantanés (émetteur, client, marque) et
   * document figé (RG-31, RG-62, RG-63). Tout se fait dans une seule transaction :
   * si l'émission échoue, le numéro n'est pas consommé (aucun trou).
   */
  async issue(tenant: TenantContext, id: string) {
    return this.tx(tenant, async (tx) => {
      const document = await lockDraft(tx, id);
      if (!document.clientId) throw new UnprocessableEntityException({ code: 'CLIENT_REQUIRED', message: 'Choisissez un client avant d’émettre le document.' });
      await this.usage.assertAvailable(tx, tenant.organizationId, 'businessDocumentsPerMonth');

      const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
      const client = await findClient(tx, document.clientId);
      const lines = document.lines as unknown as DocumentLine[];
      const totals = computeTotals(lines, { vatEnabled: organization.vatEnabled });
      const issuedAt = new Date();
      const number = await nextNumber(tx, tenant.organizationId, document.type, issuedAt);

      await tx.businessDocument.update({
        where: { id },
        data: {
          status: 'ISSUED',
          number,
          issuedAt,
          ...amounts(totals),
          lines: totals.lines.map(stripComputed) as unknown as Prisma.InputJsonValue,
          issuerSnapshot: issuerSnapshot(organization) as unknown as Prisma.InputJsonValue,
          clientSnapshot: clientSnapshot(client) as unknown as Prisma.InputJsonValue,
          brandSnapshot: (await brandSnapshot(tx)) as Prisma.InputJsonValue,
        },
      });
      await audit(tx, tenant, 'document.issue', id, { number });
      return this.getWith(tx, id, tenant);
    });
  }

  /** RG-63 : une facture émise se corrige par une facture d'avoir, qui l'annule. */
  async creditNote(tenant: TenantContext, id: string) {
    return this.tx(tenant, async (tx) => {
      const [original] = await tx.$queryRaw<BusinessDocument[]>`SELECT * FROM "BusinessDocument" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!original) throw new NotFoundException('Document introuvable.');
      if (original.type !== 'INVOICE' || original.status === 'DRAFT') {
        throw new ConflictException({ code: 'NOT_AN_ISSUED_INVOICE', message: 'Seule une facture émise peut être annulée par un avoir.' });
      }
      if (original.status === 'CANCELLED') {
        throw new ConflictException({ code: 'ALREADY_CANCELLED', message: 'Cette facture a déjà été annulée par un avoir.' });
      }
      const issuedAt = new Date();
      const number = await nextNumber(tx, tenant.organizationId, 'CREDIT_NOTE', issuedAt);
      const credit = await tx.businessDocument.create({
        data: {
          organizationId: tenant.organizationId,
          type: 'CREDIT_NOTE',
          status: 'ISSUED',
          number,
          issuedAt,
          clientId: original.clientId,
          currency: original.currency,
          lines: original.lines as Prisma.InputJsonValue,
          discountMinor: original.discountMinor,
          subtotalMinor: original.subtotalMinor,
          vatMinor: original.vatMinor,
          totalMinor: original.totalMinor,
          paymentTerms: `Avoir sur la facture ${original.number}.`,
          issuerSnapshot: original.issuerSnapshot as Prisma.InputJsonValue,
          clientSnapshot: original.clientSnapshot as Prisma.InputJsonValue,
          brandSnapshot: (await brandSnapshot(tx)) as Prisma.InputJsonValue,
          correctsId: original.id,
          createdById: tenant.userId,
        },
      });
      await tx.businessDocument.update({ where: { id: original.id }, data: { status: 'CANCELLED' } });
      await audit(tx, tenant, 'document.credit_note', original.id, { creditNote: credit.id, number });
      return this.getWith(tx, credit.id, tenant);
    });
  }

  /** Nouveau brouillon à partir d'un document existant (corriger une facture annulée, refaire un devis…). */
  async duplicate(tenant: TenantContext, id: string) {
    return this.tx(tenant, async (tx) => {
      const source = await find(tx, id);
      const type: DocumentKind = source.type === 'QUOTE' ? 'QUOTE' : 'INVOICE';
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
      const lines = source.lines as unknown as DocumentLine[];
      const totals = computeTotals(lines, { vatEnabled: organization.vatEnabled });
      const copy = await tx.businessDocument.create({
        data: {
          organizationId: tenant.organizationId,
          type,
          clientId: source.clientId,
          currency: organization.currency,
          lines: lines as unknown as Prisma.InputJsonValue,
          ...amounts(totals),
          paymentTerms: source.type === 'CREDIT_NOTE' ? DEFAULT_TERMS[type] : source.paymentTerms,
          notes: source.notes,
          createdById: tenant.userId,
        },
      });
      return this.getWith(tx, copy.id, tenant);
    });
  }

  private async getWith(tx: TenantTx, id: string, tenant: TenantContext) {
    const document = await find(tx, id);
    const client = document.clientId ? await tx.client.findUnique({ where: { id: document.clientId } }) : null;
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
    return view(document, client, organization);
  }
}

/**
 * RG-62 : numéro suivant, sans trou ni doublon. L'incrément se fait sous verrou
 * de ligne (INSERT … ON CONFLICT DO UPDATE) dans la transaction d'émission :
 * deux émissions simultanées obtiennent deux numéros consécutifs, et un échec
 * annule l'incrément avec le reste de la transaction.
 */
async function nextNumber(tx: TenantTx, organizationId: string, type: BusinessDocumentType, at: Date): Promise<string> {
  const year = Number(new Intl.DateTimeFormat('en', { timeZone: TIMEZONE, year: 'numeric' }).format(at));
  const [row] = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "DocumentSequence" ("organizationId", "type", "year", "lastNumber")
    VALUES (${organizationId}::uuid, ${type}::"BusinessDocumentType", ${year}, 1)
    ON CONFLICT ("organizationId", "type", "year")
    DO UPDATE SET "lastNumber" = "DocumentSequence"."lastNumber" + 1
    RETURNING "lastNumber"`;
  return formatDocumentNumber(type, year, row!.lastNumber);
}

async function find(tx: TenantTx, id: string): Promise<BusinessDocument> {
  const document = await tx.businessDocument.findUnique({ where: { id } });
  if (!document) throw new NotFoundException('Document introuvable.');
  return document;
}

/** Verrouille le document et vérifie qu'il est encore un brouillon (RG-63). */
async function lockDraft(tx: TenantTx, id: string): Promise<BusinessDocument> {
  const [document] = await tx.$queryRaw<BusinessDocument[]>`SELECT * FROM "BusinessDocument" WHERE "id" = ${id}::uuid FOR UPDATE`;
  if (!document) throw new NotFoundException('Document introuvable.');
  if (document.status !== 'DRAFT') {
    throw new ConflictException({
      code: 'DOCUMENT_ISSUED',
      message: 'Ce document est émis : il ne peut plus être modifié. Pour corriger une facture, émettez une facture d’avoir.',
    });
  }
  return document;
}

async function findClient(tx: TenantTx, id: string) {
  // RLS : un client d'une autre organisation est introuvable.
  const client = await tx.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundException('Client introuvable.');
  return client;
}

function amounts(totals: ReturnType<typeof computeTotals>) {
  return {
    discountMinor: BigInt(totals.discountMinor),
    subtotalMinor: BigInt(totals.subtotalMinor),
    vatMinor: BigInt(totals.vatMinor),
    totalMinor: BigInt(totals.totalMinor),
  };
}

function stripComputed(line: DocumentLine): DocumentLine {
  const { label, description, unit, quantityMilli, unitPriceMinor, discountBps, vatRateBps } = line;
  return { label, description, unit, quantityMilli, unitPriceMinor, discountBps, vatRateBps };
}

function issuerSnapshot(o: Prisma.OrganizationGetPayload<object>): IssuerSnapshot {
  return {
    name: o.name,
    address: o.address,
    city: o.city,
    phone: o.phone,
    email: o.email,
    website: o.website,
    rccm: o.rccm,
    ifu: o.ifu,
    taxRegime: o.taxRegime,
    vatEnabled: o.vatEnabled,
  };
}

function clientSnapshot(c: Prisma.ClientGetPayload<object>): ClientSnapshot {
  return { name: c.name, email: c.email, phone: c.phone, address: c.address, ifu: c.ifu };
}

/** Identité visuelle au moment de l'émission (RG-31) ; null si la marque n'est pas encore créée. */
async function brandSnapshot(tx: TenantTx) {
  const brand = await tx.brand.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { palettes: { where: { isActive: true }, take: 1 }, typographies: { where: { isActive: true }, take: 1 } },
  });
  const logo = logoSpecSchema.safeParse(brand?.logo);
  if (!brand || !logo.success || !brand.palettes[0] || !brand.typographies[0]) return null;
  return {
    version: brand.activeVersionNum,
    logo: logo.data,
    colors: brand.palettes[0].colors,
    typography: { heading: brand.typographies[0].headingFont, body: brand.typographies[0].bodyFont },
  };
}

async function audit(tx: TenantTx, tenant: TenantContext, action: string, id: string, metadata: Prisma.InputJsonObject) {
  await tx.auditLog.create({
    data: { actorId: tenant.userId, organizationId: tenant.organizationId, action, resourceType: 'BusinessDocument', resourceId: id, metadata },
  });
}

function snapshotName(d: BusinessDocument): string | null {
  return (d.clientSnapshot as ClientSnapshot | null)?.name ?? null;
}

function summary(d: BusinessDocument) {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    number: d.number,
    currency: d.currency,
    subtotalMinor: Number(d.subtotalMinor),
    vatMinor: Number(d.vatMinor),
    totalMinor: Number(d.totalMinor),
    issuedAt: d.issuedAt,
    dueAt: d.dueAt,
    correctsId: d.correctsId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** Un document émis montre les instantanés figés ; un brouillon, les données actuelles. */
function view(d: BusinessDocument, client: Prisma.ClientGetPayload<object> | null, organization: Prisma.OrganizationGetPayload<object>) {
  const issued = d.status !== 'DRAFT';
  return {
    ...summary(d),
    clientId: d.clientId,
    lines: d.lines as unknown as DocumentLine[],
    discountMinor: Number(d.discountMinor),
    paymentTerms: d.paymentTerms,
    notes: d.notes,
    client: issued ? (d.clientSnapshot as ClientSnapshot | null) : client && clientSnapshot(client),
    issuer: issued ? (d.issuerSnapshot as IssuerSnapshot | null) : issuerSnapshot(organization),
  };
}
