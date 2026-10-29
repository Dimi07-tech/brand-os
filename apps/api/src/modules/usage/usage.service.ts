import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { TenantTx } from '@brand-os/db';
import { PLAN_DEFINITIONS, QUOTA_WARNING_RATIO, type Plan, type PlanQuotas } from '@brand-os/shared';

export interface QuotaStatus {
  used: number;
  /** null = illimité */
  limit: number | null;
  /** RG-71 : prévenir à 80 % */
  warning: boolean;
}

type CountedQuota = 'aiGenerationsPerMonth' | 'brands' | 'hdExportsPerMonth' | 'businessDocumentsPerMonth';

const QUOTA_LABELS: Record<CountedQuota, string> = {
  aiGenerationsPerMonth: 'générations IA ce mois-ci',
  brands: 'marques',
  hdExportsPerMonth: 'exports haute définition ce mois-ci',
  businessDocumentsPerMonth: 'factures ou devis ce mois-ci',
};

/** Quotas par offre — §6.2, vérifiés côté serveur à chaque opération (RG-70). */
@Injectable()
export class UsageService {
  async plan(tx: TenantTx, organizationId: string): Promise<{ plan: Plan; quotas: PlanQuotas }> {
    const subscription = await tx.subscription.findUnique({ where: { organizationId }, select: { plan: true } });
    const plan = subscription?.plan ?? 'FREE';
    return { plan, quotas: PLAN_DEFINITIONS[plan].quotas };
  }

  async status(tx: TenantTx, organizationId: string, quota: CountedQuota): Promise<QuotaStatus> {
    const { quotas } = await this.plan(tx, organizationId);
    const limit = quotas[quota];
    const used = await this.count(tx, organizationId, quota);
    return { used, limit, warning: limit !== null && used >= limit * QUOTA_WARNING_RATIO };
  }

  /**
   * Bloque l'action si le quota est atteint (RG-71). Le verrou consultatif
   * sérialise les opérations d'une même organisation jusqu'à la fin de la
   * transaction : deux requêtes simultanées ne peuvent pas dépasser le quota.
   */
  async assertAvailable(tx: TenantTx, organizationId: string, quota: CountedQuota): Promise<QuotaStatus> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${quota}:${organizationId}`}))`;
    const status = await this.status(tx, organizationId, quota);
    if (status.limit !== null && status.used >= status.limit) {
      throw new HttpException(
        {
          code: 'QUOTA_EXCEEDED',
          quota,
          ...status,
          message: `Vous avez atteint la limite de ${status.limit} ${QUOTA_LABELS[quota]} de votre offre. Passez à l’offre supérieure pour continuer.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return status;
  }

  private count(tx: TenantTx, organizationId: string, quota: CountedQuota): Promise<number> {
    if (quota === 'brands') return tx.brand.count({ where: { organizationId } });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (quota === 'businessDocumentsPerMonth') {
      // Factures et devis émis ; les avoirs (corrections) ne comptent pas.
      return tx.businessDocument.count({
        where: { organizationId, type: { in: ['INVOICE', 'QUOTE'] }, issuedAt: { gte: monthStart } },
      });
    }
    if (quota === 'hdExportsPerMonth') {
      return tx.export.count({ where: { organizationId, quotaCharged: true, createdAt: { gte: monthStart } } });
    }
    return tx.aIGeneration.count({
      where: { organizationId, type: 'LOGO', quotaCharged: true, createdAt: { gte: monthStart } },
    });
  }
}
