// Montant en toutes lettres (« Arrêtée la présente facture à la somme de… »),
// mention d'usage sur les factures en Afrique francophone. Règles de 1990 :
// traits d'union partout, « cent » et « vingt » au pluriel quand ils terminent le nombre.

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function belowHundred(n: number): string {
  if (n < 20) return UNITS[n]!;
  const ten = Math.floor(n / 10);
  let unit = n % 10;
  if (ten === 7 || ten === 9) unit += 10; // soixante-dix, quatre-vingt-dix
  const base = TENS[ten]!;
  if (unit === 0) return ten === 8 ? 'quatre-vingts' : base;
  if (unit === 1 && ten !== 8 && ten !== 9) return `${base}-et-un`;
  if (unit === 11 && ten === 7) return `${base}-et-onze`;
  return `${base}-${UNITS[unit]}`;
}

function belowThousand(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    const cent = hundreds === 1 ? 'cent' : `${UNITS[hundreds]}-cent`;
    parts.push(rest === 0 && hundreds > 1 && final ? `${cent}s` : cent);
  }
  if (rest > 0) {
    const words = belowHundred(rest);
    // « quatre-vingts » perd son s devant un autre nombre (mille, millions…)
    parts.push(!final && words === 'quatre-vingts' ? 'quatre-vingt' : words);
  }
  return parts.join('-');
}

const SCALES: [number, string, string][] = [
  [1_000_000_000_000, 'billion', 'billions'],
  [1_000_000_000, 'milliard', 'milliards'],
  [1_000_000, 'million', 'millions'],
];

/** Entier positif en lettres : 59000 → « cinquante-neuf-mille ». */
export function numberToFrenchWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Entier positif attendu');
  if (value === 0) return 'zéro';
  const parts: string[] = [];
  let rest = value;
  for (const [size, singular, plural] of SCALES) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${belowThousand(count, true)}-${count > 1 ? plural : singular}`);
      rest %= size;
    }
  }
  const thousands = Math.floor(rest / 1000);
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${belowThousand(thousands, false)}-mille`);
    rest %= 1000;
  }
  if (rest > 0) parts.push(belowThousand(rest, true));
  return parts.join('-');
}

/** « cinquante-neuf-mille francs CFA » */
export function amountInWords(amountMinor: number, currency: 'XOF' | 'EUR' | 'USD'): string {
  const abs = Math.abs(amountMinor);
  if (currency === 'XOF') return `${numberToFrenchWords(abs)} franc${abs > 1 ? 's' : ''} CFA`;
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  const name = currency === 'EUR' ? 'euro' : 'dollar';
  const main = `${numberToFrenchWords(units)} ${name}${units > 1 ? 's' : ''}`;
  return cents > 0 ? `${main} et ${numberToFrenchWords(cents)} centime${cents > 1 ? 's' : ''}` : main;
}
