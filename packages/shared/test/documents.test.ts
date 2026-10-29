// Factures et devis — RG-60 à RG-62
import { describe, expect, it } from 'vitest';
import {
  amountInWords,
  computeTotals,
  documentDraftSchema,
  formatDocumentNumber,
  formatMoney,
  formatQuantity,
  mulDivRound,
  numberToFrenchWords,
  parseMoney,
  parseQuantity,
  type DocumentLineInput,
} from '../src/index.js';

const line = (overrides: Partial<DocumentLineInput> = {}): DocumentLineInput => ({
  label: 'Prestation',
  quantityMilli: 1000,
  unitPriceMinor: 50_000,
  discountBps: 0,
  vatRateBps: 1800,
  ...overrides,
});

describe('calculs (RG-60, RG-61)', () => {
  it('calcule HT, TVA à 18 % et TTC', () => {
    const t = computeTotals([line()], { vatEnabled: true });
    expect(t).toMatchObject({ subtotalMinor: 50_000, vatMinor: 9_000, totalMinor: 59_000 });
    expect(t.vatGroups).toEqual([{ rateBps: 1800, baseMinor: 50_000, vatMinor: 9_000 }]);
  });

  it('arrondit à l’unité la plus proche (quantité décimale, remise)', () => {
    // 1,5 x 999 = 1 498,5 → 1 499 ; remise 10 % = 149,9 → 150 ; HT 1 349
    const t = computeTotals([line({ quantityMilli: 1500, unitPriceMinor: 999, discountBps: 1000 })], { vatEnabled: true });
    expect(t.lines[0]).toMatchObject({ grossMinor: 1499, discountMinor: 150, netMinor: 1349 });
    expect(t.vatMinor).toBe(243); // 1 349 x 18 % = 242,82
  });

  it('calcule la TVA par taux sur le total, sans cumuler les arrondis', () => {
    // 3 lignes à 1 FCFA : 0,18 de TVA chacune. Ligne par ligne : 0 ; sur le total : 0,54 → 1.
    const t = computeTotals([line({ unitPriceMinor: 1 }), line({ unitPriceMinor: 1 }), line({ unitPriceMinor: 1 })], { vatEnabled: true });
    expect(t.vatMinor).toBe(1);
  });

  it('regroupe la TVA par taux', () => {
    const t = computeTotals([line(), line({ unitPriceMinor: 10_000, vatRateBps: 0 }), line({ unitPriceMinor: 20_000 })], { vatEnabled: true });
    expect(t.vatGroups).toEqual([{ rateBps: 1800, baseMinor: 70_000, vatMinor: 12_600 }]);
    expect(t).toMatchObject({ subtotalMinor: 80_000, totalMinor: 92_600 });
  });

  it('n’applique pas de TVA si l’entreprise n’y est pas assujettie (RG-61)', () => {
    const t = computeTotals([line()], { vatEnabled: false });
    expect(t).toMatchObject({ subtotalMinor: 50_000, vatMinor: 0, totalMinor: 50_000, vatGroups: [] });
    expect(t.lines[0]!.vatRateBps).toBe(0);
  });

  it('reste exact sur de très gros montants (aucun flottant)', () => {
    const t = computeTotals([line({ quantityMilli: 999_999_000, unitPriceMinor: 999_999_999 })], { vatEnabled: true });
    expect(t.subtotalMinor).toBe(999_998_999_000_001);
    expect(Number.isSafeInteger(t.totalMinor)).toBe(true);
  });

  it('arrondit symétriquement les montants négatifs (avoirs)', () => {
    expect(mulDivRound(1499, 1000, 10_000)).toBe(150);
    expect(mulDivRound(-1499, 1000, 10_000)).toBe(-150);
    expect(mulDivRound(-15, 1, 10)).toBe(-2);
  });

  it('ne produit que des entiers, pour 1 000 documents aléatoires', () => {
    let seed = 7;
    const rand = (max: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % max);
    for (let i = 0; i < 1000; i++) {
      const lines = Array.from({ length: 1 + rand(8) }, () =>
        line({ quantityMilli: 1 + rand(50_000), unitPriceMinor: rand(5_000_000), discountBps: rand(3) ? 0 : rand(10_001), vatRateBps: [0, 1800, 1000][rand(3)]! }),
      );
      const t = computeTotals(lines, { vatEnabled: true });
      for (const v of [t.subtotalMinor, t.vatMinor, t.totalMinor, ...t.lines.map((l) => l.netMinor)]) expect(Number.isInteger(v)).toBe(true);
      expect(t.totalMinor).toBe(t.subtotalMinor + t.vatMinor);
      expect(t.subtotalMinor).toBe(t.grossMinor - t.discountMinor);
    }
  });
});

describe('saisie et affichage', () => {
  it('lit les montants et les quantités saisis à la française', () => {
    expect(parseMoney('25 000', 'XOF')).toBe(25_000);
    expect(parseMoney('12,5', 'XOF')).toBeNull(); // pas de centimes en FCFA
    expect(parseMoney('12,5', 'EUR')).toBe(1250);
    expect(parseMoney('abc', 'XOF')).toBeNull();
    expect(parseQuantity('1,5')).toBe(1500);
    expect(parseQuantity('2')).toBe(2000);
    expect(parseQuantity('1,2345')).toBeNull();
  });

  it('formate les montants', () => {
    expect(formatMoney(59_000, 'XOF')).toBe('59 000 FCFA');
    expect(formatMoney(125_050, 'EUR')).toBe('1 250,50 €');
    expect(formatQuantity(1500)).toBe('1,5');
  });

  it('numérote FAC-2026-0001, DEV-2026-0012, AV-2026-0003 (RG-62)', () => {
    expect(formatDocumentNumber('INVOICE', 2026, 1)).toBe('FAC-2026-0001');
    expect(formatDocumentNumber('QUOTE', 2026, 12)).toBe('DEV-2026-0012');
    expect(formatDocumentNumber('CREDIT_NOTE', 2026, 3)).toBe('AV-2026-0003');
  });

  it('valide un brouillon', () => {
    expect(documentDraftSchema.safeParse({ lines: [] }).error?.issues[0]?.message).toBe('Ajoutez au moins une ligne');
    expect(documentDraftSchema.safeParse({ lines: [{ ...line(), quantityMilli: 0 }] }).success).toBe(false);
    expect(documentDraftSchema.safeParse({ lines: [{ ...line(), unitPriceMinor: 1.5 }] }).success).toBe(false);
    expect(documentDraftSchema.safeParse({ lines: [line()], dueDate: '2026-13-45' }).success).toBe(false);
  });
});

describe('montant en lettres', () => {
  it.each([
    [0, 'zéro'],
    [1, 'un'],
    [17, 'dix-sept'],
    [21, 'vingt-et-un'],
    [71, 'soixante-et-onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [100, 'cent'],
    [200, 'deux-cents'],
    [201, 'deux-cent-un'],
    [1000, 'mille'],
    [1999, 'mille-neuf-cent-quatre-vingt-dix-neuf'],
    [59_000, 'cinquante-neuf-mille'],
    [80_000, 'quatre-vingt-mille'],
    [200_000, 'deux-cent-mille'],
    [1_000_000, 'un-million'],
    [2_500_000, 'deux-millions-cinq-cent-mille'],
    [80_000_000, 'quatre-vingts-millions'],
    [1_000_000_000, 'un-milliard'],
  ])('%i → %s', (n, words) => {
    expect(numberToFrenchWords(n)).toBe(words);
  });

  it('écrit la somme avec la devise', () => {
    expect(amountInWords(59_000, 'XOF')).toBe('cinquante-neuf-mille francs CFA');
    expect(amountInWords(1, 'XOF')).toBe('un franc CFA');
    expect(amountInWords(125_050, 'EUR')).toBe('mille-deux-cent-cinquante euros et cinquante centimes');
    expect(amountInWords(-59_000, 'XOF')).toBe('cinquante-neuf-mille francs CFA');
  });
});
