import { z } from 'zod';
import { SECTORS, type Sector } from '../schemas/organization.js';
import {
  AUDIENCE_LABELS,
  BRAND_VALUE_LABELS,
  BRAND_VALUES,
  VISUAL_STYLE_LABELS,
  type BrandBrief,
  type BrandValue,
} from './brief.js';

// Textes de la charte graphique — §4.5 (US-40, US-41). Proposés automatiquement
// (rédaction par règles en attendant le modèle de langage, §8.2), puis corrigés
// par l'utilisateur avant l'export.

const paragraph = (max: number) => z.string().trim().min(1, 'Ce texte ne peut pas être vide').max(max, `${max} caractères au maximum`);

export const guidelinesTextSchema = z.object({
  presentation: paragraph(1200),
  mission: paragraph(600),
  values: z
    .array(z.object({ value: z.enum(BRAND_VALUES), description: paragraph(300) }))
    .min(1)
    .max(5),
  usageRules: z.array(paragraph(200)).min(1).max(8),
  forbiddenUses: z.array(paragraph(200)).min(1).max(8),
});
export type GuidelinesText = z.infer<typeof guidelinesTextSchema>;

const SECTOR_ACTIVITY: Record<Sector, string> = {
  restauration: 'la restauration et l’alimentation',
  'beaute-mode': 'la beauté et la mode',
  commerce: 'le commerce',
  btp: 'le bâtiment et les travaux publics',
  'services-entreprises': 'les services aux entreprises',
  education: 'l’éducation',
  evenementiel: 'l’événementiel',
  autre: 'son domaine d’activité',
};

const VALUE_DESCRIPTIONS: Record<BrandValue, string> = {
  qualite: 'Nous ne transigeons pas sur la qualité : chaque produit et chaque service doit être à la hauteur de ce que nous promettons.',
  fiabilite: 'Nos clients peuvent compter sur nous : nous tenons nos engagements, nos délais et notre parole.',
  proximite: 'Nous restons proches de nos clients, à l’écoute de leurs besoins, avec un contact simple et direct.',
  innovation: 'Nous cherchons sans cesse de meilleures façons de faire, pour garder une longueur d’avance.',
  tradition: 'Nous sommes fiers de notre savoir-faire et des traditions qui font notre identité.',
  elegance: 'Nous soignons chaque détail, avec sobriété et raffinement.',
  rapidite: 'Nous répondons vite et livrons à temps : le temps de nos clients est précieux.',
  creativite: 'Nous imaginons des solutions originales, qui sortent de l’ordinaire.',
  convivialite: 'Nous accueillons chacun avec chaleur : chez nous, on se sent bien.',
  excellence: 'Nous visons le meilleur, dans chaque réalisation.',
  simplicite: 'Nous rendons les choses simples et claires pour nos clients.',
  authenticite: 'Nous sommes vrais : nous restons fidèles à ce que nous sommes et à nos racines.',
  durabilite: 'Nous construisons pour durer, avec respect pour les personnes et l’environnement.',
  audace: 'Nous osons : nous prenons des initiatives et assumons nos choix.',
  securite: 'La sécurité de nos clients et de nos équipes passe avant tout.',
};

/** Premier jet des textes de la charte, à partir du questionnaire (US-20). */
export function defaultGuidelinesText(brief: BrandBrief): GuidelinesText {
  const sector = SECTORS.includes(brief.sector) ? SECTOR_ACTIVITY[brief.sector] : SECTOR_ACTIVITY.autre;
  const audience = brief.audience.map((a) => AUDIENCE_LABELS[a].toLowerCase()).join(', ');
  const values = brief.values.map((v) => BRAND_VALUE_LABELS[v].toLowerCase());
  const style = VISUAL_STYLE_LABELS[brief.style];

  return {
    presentation:
      `${brief.name} exerce dans ${sector} et s’adresse en priorité à : ${audience}. ` +
      (brief.slogan ? `Sa promesse tient en quelques mots : « ${brief.slogan} ». ` : '') +
      `Son identité visuelle se veut ${style.label.toLowerCase()} (${style.description.toLowerCase()}), ` +
      `à l’image des valeurs qui la guident : ${values.join(', ')}.`,
    mission: `Offrir à nos clients un service fiable et de qualité, porté par ${values.slice(0, 2).join(' et ')}, et devenir une référence dans ${sector}.`,
    values: brief.values.map((value) => ({ value, description: VALUE_DESCRIPTIONS[value] })),
    usageRules: [
      'Utiliser uniquement les fichiers officiels du logo, fournis dans le Brand Kit.',
      'Laisser autour du logo un espace libre au moins égal à la hauteur de son symbole.',
      'Ne pas reproduire le logo en dessous de 2 cm de large (ou 80 pixels à l’écran).',
      'Sur un fond foncé ou une photo, utiliser la version claire du logo.',
      'Utiliser les couleurs et les polices de la marque sur tous les supports.',
    ],
    forbiddenUses: [
      'Déformer, étirer ou incliner le logo.',
      'Changer les couleurs du logo en dehors des versions prévues.',
      'Ajouter une ombre, un contour ou un effet au logo.',
      'Placer le logo sur un fond chargé qui nuit à sa lisibilité.',
      'Modifier la police, la disposition ou les proportions du logo.',
    ],
  };
}
