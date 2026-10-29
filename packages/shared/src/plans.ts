// Grille tarifaire et quotas — cahier des charges §6.1 et §6.2.
// Hypothèses à valider pendant le pilote : modifier ici, pas dans le code métier.

export const PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'AGENCY'] as const;
export type Plan = (typeof PLANS)[number];

/** null = illimité */
export interface PlanQuotas {
  brands: number;
  aiGenerationsPerMonth: number;
  hdExportsPerMonth: number | null;
  businessDocumentsPerMonth: number | null;
  members: number;
  storageBytes: number;
  watermarkedExports: boolean;
  svgAndGuidelines: boolean;
}

export interface PlanDefinition {
  /** Prix en FCFA (XOF, sans décimales) */
  monthlyPriceXof: number;
  yearlyPriceXof: number | null;
  quotas: PlanQuotas;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    monthlyPriceXof: 0,
    yearlyPriceXof: null,
    quotas: {
      brands: 1,
      aiGenerationsPerMonth: 12,
      hdExportsPerMonth: 2,
      businessDocumentsPerMonth: 3,
      members: 1,
      storageBytes: 200 * MB,
      watermarkedExports: true,
      svgAndGuidelines: false,
    },
  },
  STARTER: {
    monthlyPriceXof: 3_500,
    yearlyPriceXof: 33_600,
    quotas: {
      brands: 1,
      aiGenerationsPerMonth: 60,
      hdExportsPerMonth: 30,
      businessDocumentsPerMonth: 30,
      members: 1,
      storageBytes: 2 * GB,
      watermarkedExports: false,
      svgAndGuidelines: true,
    },
  },
  PRO: {
    monthlyPriceXof: 9_900,
    yearlyPriceXof: 95_000,
    quotas: {
      brands: 2,
      aiGenerationsPerMonth: 200,
      hdExportsPerMonth: null,
      businessDocumentsPerMonth: null,
      members: 3,
      storageBytes: 10 * GB,
      watermarkedExports: false,
      svgAndGuidelines: true,
    },
  },
  BUSINESS: {
    monthlyPriceXof: 24_900,
    yearlyPriceXof: 239_000,
    quotas: {
      brands: 5,
      aiGenerationsPerMonth: 600,
      hdExportsPerMonth: null,
      businessDocumentsPerMonth: null,
      members: 10,
      storageBytes: 50 * GB,
      watermarkedExports: false,
      svgAndGuidelines: true,
    },
  },
  AGENCY: {
    monthlyPriceXof: 49_900,
    yearlyPriceXof: 479_000,
    quotas: {
      brands: 25,
      aiGenerationsPerMonth: 1_500,
      hdExportsPerMonth: null,
      businessDocumentsPerMonth: null,
      members: 25,
      storageBytes: 200 * GB,
      watermarkedExports: false,
      svgAndGuidelines: true,
    },
  },
};

/** Achat unique : logo + Brand Kit + charte, sans abonnement */
export const IDENTITY_PACK_PRICE_XOF = 15_000;

/** RG-71 : avertissement à 80 %, blocage à 100 % */
export const QUOTA_WARNING_RATIO = 0.8;
