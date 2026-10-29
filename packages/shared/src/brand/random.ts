// Aléatoire reproductible : une même graine donne les mêmes propositions,
// une nouvelle graine (« autres propositions », US-21) en donne d'autres.

export type Random = () => number;

/** Générateur pseudo-aléatoire mulberry32, valeurs dans [0, 1). */
export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Empreinte 32 bits (FNV-1a) d'une chaîne, pour dériver une graine. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pick<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() sur une liste vide');
  return items[Math.floor(random() * items.length)]!;
}

export function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
