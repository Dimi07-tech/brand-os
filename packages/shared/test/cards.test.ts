// Cartes de visite — US-50, US-51, RG-50
import { describe, expect, it } from 'vitest';
import {
  BUSINESS_CARD_TEMPLATES,
  businessCardCompositionSchema,
  CARD,
  composeLogoProposals,
  generatePalettes,
  generationSeed,
  qrContent,
  qrPath,
  renderBusinessCard,
  ruleBasedCreativeBrief,
  SECTORS,
  VISUAL_STYLES,
  whatsappNumber,
  type BrandBrief,
  type BusinessCardFields,
  type BusinessCardInput,
} from '../src/index.js';

const briefs: BrandBrief[] = SECTORS.map((sector, i) => ({
  name: ['Chez Aïcha', 'Agossou BTP', 'Beauté Divine', 'Tokpa Market', 'Sèmè Conseil', 'Les Lauréats', 'Ganvié Events', 'Ɖokpo & Fils'][i]!,
  slogan: i % 2 ? 'Un slogan assez long pour tester la mise en page' : undefined,
  sector,
  audience: ['grand-public'],
  values: ['qualite', 'fiabilite', 'proximite'],
  style: VISUAL_STYLES[i % VISUAL_STYLES.length]!,
  preferredColors: [],
  avoidedColors: [],
}));

const FIELDS: Record<string, BusinessCardFields> = {
  court: { fullName: 'Aïcha' },
  typique: {
    fullName: 'Aïcha Dossou',
    jobTitle: 'Gérante',
    phone: '+229 01 97 00 00 00',
    email: 'aicha@chezaicha.bj',
    website: 'www.chezaicha.bj',
    address: 'Haie Vive, Cotonou',
  },
  long: {
    fullName: 'Marie-Christelle Ahouansou-Tchobo de Souza',
    jobTitle: 'Directrice générale adjointe chargée du développement commercial',
    phone: '+229 01 97 00 00 00 / +229 01 66 00 00 00',
    email: 'marie-christelle.ahouansou-tchobo@entreprise-tres-longue.bj',
    website: 'https://www.une-entreprise-avec-un-nom-de-domaine-tres-long.bj',
    address: 'Lot 1234, quartier Haie Vive, rue 12.345, 01 BP 1234 Cotonou, Bénin',
  },
};

function inputFor(brief: BrandBrief, templateId: string, fields: BusinessCardFields, qr: BusinessCardInput['qr']): BusinessCardInput {
  const seed = generationSeed(brief, 0);
  const palettes = generatePalettes(brief, seed);
  const logo = composeLogoProposals(brief, ruleBasedCreativeBrief(brief, seed), palettes, seed)[seed % 6]!;
  return { templateId, logo, colors: palettes[0]!.colors, typography: { heading: logo.font, body: 'Inter' }, fields, qr };
}

describe('modèles (US-50)', () => {
  it('propose 20 modèles uniques', () => {
    expect(BUSINESS_CARD_TEMPLATES).toHaveLength(20);
    expect(new Set(BUSINESS_CARD_TEMPLATES.map((t) => t.id)).size).toBe(20);
  });
});

describe('zone de sécurité (RG-50)', () => {
  it('garde tout le contenu à 3 mm des bords, pour tous les modèles, marques et longueurs de texte', () => {
    const safe = { left: CARD.safe, top: CARD.safe, right: CARD.width - CARD.safe, bottom: CARD.height - CARD.safe };
    const tolerance = 0.05;
    let checked = 0;
    for (const brief of briefs) {
      for (const template of BUSINESS_CARD_TEMPLATES) {
        for (const [label, fields] of Object.entries(FIELDS)) {
          for (const side of ['front', 'back'] as const) {
            const { contentBoxes } = renderBusinessCard(inputFor(brief, template.id, fields, 'whatsapp'), side);
            for (const b of contentBoxes) {
              const where = `${template.id} ${side} ${label} ${brief.name} ${b.kind} ${JSON.stringify(b)}`;
              expect(b.x, where).toBeGreaterThanOrEqual(safe.left - tolerance);
              expect(b.y, where).toBeGreaterThanOrEqual(safe.top - tolerance);
              expect(b.x + b.width, where).toBeLessThanOrEqual(safe.right + tolerance);
              expect(b.y + b.height, where).toBeLessThanOrEqual(safe.bottom + tolerance);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('ne réduit jamais le texte sous 6 points', () => {
    const { svg } = renderBusinessCard(inputFor(briefs[0]!, 'classique-clair', FIELDS.long!, 'none'), 'back');
    const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2.1);
    expect(svg).toContain('…');
  });
});

describe('format d’impression (RG-50)', () => {
  it('produit 91 x 61 mm avec fond perdu, 85 x 55 mm sinon', () => {
    const input = inputFor(briefs[0]!, 'classique-couleur', FIELDS.typique!, 'whatsapp');
    expect(renderBusinessCard(input, 'front', undefined, { bleed: true }).svg).toMatch(/viewBox="0 0 91 61" width="91mm" height="61mm"/);
    expect(renderBusinessCard(input, 'front').svg).toMatch(/viewBox="3 3 85 55" width="85mm" height="55mm"/);
  });

  it('étend le fond dans le fond perdu', () => {
    const { svg } = renderBusinessCard(inputFor(briefs[0]!, 'classique-couleur', FIELDS.typique!, 'none'), 'front', undefined, { bleed: true });
    expect(svg).toContain('<rect x="-3" y="-3" width="91" height="61"');
  });

  it('échappe les textes saisis', () => {
    const { svg } = renderBusinessCard(inputFor(briefs[0]!, 'cadre-clair', { fullName: '<script>alert(1)</script>' }, 'none'), 'back');
    expect(svg).not.toContain('<script>');
  });
});

describe('QR code (US-51)', () => {
  it('normalise les numéros béninois pour WhatsApp', () => {
    expect(whatsappNumber('+229 01 97 00 00 00')).toBe('2290197000000');
    expect(whatsappNumber('01 97 00 00 00')).toBe('2290197000000');
    expect(whatsappNumber('97 00 00 00')).toBe('2290197000000'); // ancien format à 8 chiffres
    expect(whatsappNumber('00229 0197000000')).toBe('2290197000000');
    expect(whatsappNumber('+33 6 12 34 56 78')).toBe('33612345678');
    expect(whatsappNumber('123')).toBeNull();
  });

  it('pointe vers WhatsApp ou le site, et rien sans coordonnée', () => {
    expect(qrContent({ fullName: 'A', phone: '0197000000' }, 'whatsapp')).toBe('https://wa.me/2290197000000');
    expect(qrContent({ fullName: 'A', phone: '0197000000', whatsapp: '0166000000' }, 'whatsapp')).toBe('https://wa.me/2290166000000');
    expect(qrContent({ fullName: 'A', website: 'chezaicha.bj' }, 'website')).toBe('https://chezaicha.bj');
    expect(qrContent({ fullName: 'A' }, 'website')).toBeNull();
    expect(qrContent({ fullName: 'A', phone: '0197000000' }, 'none')).toBeNull();
  });

  it('dessine un QR vectoriel avec sa marge', () => {
    const { d, size } = qrPath('https://wa.me/2290197000000');
    expect(size).toBeGreaterThanOrEqual(25);
    expect(d).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it('n’affiche pas de QR si la cible est absente', () => {
    const { contentBoxes } = renderBusinessCard(inputFor(briefs[0]!, 'classique-clair', { fullName: 'Aïcha' }, 'whatsapp'), 'back');
    expect(contentBoxes.some((b) => b.kind === 'qr')).toBe(false);
  });
});

describe('composition enregistrée', () => {
  it('valide le modèle et les champs', () => {
    const base = { schemaVersion: 1, kind: 'BUSINESS_CARD', templateId: 'vague-clair', fields: FIELDS.typique, qr: 'whatsapp' };
    expect(businessCardCompositionSchema.safeParse(base).success).toBe(true);
    expect(businessCardCompositionSchema.safeParse({ ...base, templateId: 'inconnu' }).success).toBe(false);
    expect(businessCardCompositionSchema.safeParse({ ...base, fields: { ...FIELDS.typique, email: 'pas-un-email' } }).success).toBe(false);
  });
});
