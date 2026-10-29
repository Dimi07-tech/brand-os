// Calculs des factures et devis — RG-60, RG-61. Montants en entiers d'unités
// mineures (FCFA sans décimale ; centimes pour EUR et USD), jamais en flottant.
// Le serveur fait foi ; le même code donne l'aperçu en direct dans le navigateur.

export const CURRENCY_DECIMALS = { XOF: 0, EUR: 2, USD: 2 } as const;
export type Currency = keyof typeof CURRENCY_DECIMALS;

/** Taux de TVA par défaut au Bénin : 18 % (RG-61), en points de base. */
export const DEFAULT_VAT_BPS = 1800;
/** Quantités en millièmes : 1,5 kg = 1500. */
export const QUANTITY_SCALE = 1000;

export interface DocumentLineInput {
  label: string;
  description?: string;
  unit?: string;
  /** Quantité en millièmes (entier) */
  quantityMilli: number;
  /** Prix unitaire hors taxe, en unités mineures (entier) */
  unitPriceMinor: number;
  /** Remise sur la ligne, en points de base (0 à 10 000) */
  discountBps: number;
  /** Taux de TVA, en points de base (1800 = 18 %) */
  vatRateBps: number;
}

export interface ComputedLine extends DocumentLineInput {
  grossMinor: number;
  discountMinor: number;
  /** Total hors taxe de la ligne */
  netMinor: number;
}

export interface VatGroup {
  rateBps: number;
  baseMinor: number;
  vatMinor: number;
}

export interface DocumentTotals {
  lines: ComputedLine[];
  grossMinor: number;
  discountMinor: number;
  /** Total HT */
  subtotalMinor: number;
  vatGroups: VatGroup[];
  vatMinor: number;
  /** Total TTC */
  totalMinor: number;
}

/** a × b / c arrondi à l'entier le plus proche (demi vers l'extérieur), en BigInt : aucun débordement ni flottant. */
export function mulDivRound(a: number, b: number, c: number): number {
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(c);
  const q = num / den;
  const r = num % den;
  const twice = (r < 0n ? -r : r) * 2n;
  const adjust = twice >= (den < 0n ? -den : den) ? (num < 0n !== den < 0n ? -1n : 1n) : 0n;
  return Number(q + adjust);
}

/**
 * Totaux d'un document. La TVA est calculée par taux sur la somme des lignes
 * hors taxe (et non ligne par ligne), pour éviter le cumul des arrondis.
 */
export function computeTotals(lines: readonly DocumentLineInput[], options: { vatEnabled: boolean }): DocumentTotals {
  const computed = lines.map((line): ComputedLine => {
    const vatRateBps = options.vatEnabled ? line.vatRateBps : 0;
    const grossMinor = mulDivRound(line.quantityMilli, line.unitPriceMinor, QUANTITY_SCALE);
    const discountMinor = mulDivRound(grossMinor, line.discountBps, 10_000);
    return { ...line, vatRateBps, grossMinor, discountMinor, netMinor: grossMinor - discountMinor };
  });

  const bases = new Map<number, number>();
  for (const line of computed) bases.set(line.vatRateBps, (bases.get(line.vatRateBps) ?? 0) + line.netMinor);
  const vatGroups = [...bases.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rateBps, baseMinor]) => ({ rateBps, baseMinor, vatMinor: mulDivRound(baseMinor, rateBps, 10_000) }));

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const subtotalMinor = sum(computed.map((l) => l.netMinor));
  const vatMinor = sum(vatGroups.map((g) => g.vatMinor));
  return {
    lines: computed,
    grossMinor: sum(computed.map((l) => l.grossMinor)),
    discountMinor: sum(computed.map((l) => l.discountMinor)),
    subtotalMinor,
    vatGroups: vatGroups.filter((g) => g.rateBps > 0),
    vatMinor,
    totalMinor: subtotalMinor + vatMinor,
  };
}

/** « 59 000 FCFA », « 1 250,50 € ». */
export function formatMoney(amountMinor: number, currency: Currency): string {
  const decimals = CURRENCY_DECIMALS[currency];
  const value = amountMinor / 10 ** decimals;
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .format(value)
    .replace(/ | /g, ' ');
  return currency === 'XOF' ? `${formatted} FCFA` : currency === 'EUR' ? `${formatted} €` : `${formatted} $`;
}

/** Montant saisi (« 1 250,5 ») → unités mineures, ou null si invalide. */
export function parseMoney(input: string, currency: Currency): number | null {
  const normalized = input.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const decimals = CURRENCY_DECIMALS[currency];
  const [int, frac = ''] = normalized.split('.');
  if (frac.length > decimals) return null;
  return Number(int) * 10 ** decimals + Number(frac.padEnd(decimals, '0') || '0');
}

/** Quantité saisie (« 1,5 ») → millièmes, ou null si invalide (3 décimales au plus). */
export function parseQuantity(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  const [int, frac = ''] = normalized.split('.');
  return Number(int) * QUANTITY_SCALE + Number(frac.padEnd(3, '0'));
}

export function formatQuantity(quantityMilli: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(quantityMilli / QUANTITY_SCALE).replace(/ | /g, ' ');
}

export function formatRate(bps: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(bps / 100)} %`;
}
