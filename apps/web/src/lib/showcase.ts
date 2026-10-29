import {
  composeLogoProposals,
  generatePalettes,
  generationSeed,
  ruleBasedCreativeBrief,
  type BrandBrief,
  type LogoSpec,
  type Palette,
} from "@brand-os/shared";

// Marques d'exemple de la vitrine : entreprises fictives, mais logos et palettes
// réellement produits par le moteur de Brand OS à partir de leur questionnaire.

export interface ShowcaseBrand {
  brief: BrandBrief;
  sectorLabel: string;
  logo: LogoSpec;
  palette: Palette;
}

const EXAMPLES: { brief: BrandBrief; sectorLabel: string; pick: number }[] = [
  {
    sectorLabel: "Restaurant · Cotonou",
    pick: 0,
    brief: { name: "Chez Aïcha", slogan: "Le goût de Cotonou", sector: "restauration", audience: ["familles"], values: ["convivialite", "qualite", "authenticite"], style: "ludique", preferredColors: ["orange"], avoidedColors: [] },
  },
  {
    sectorLabel: "BTP · Porto-Novo",
    pick: 2,
    brief: { name: "Agossou BTP", slogan: "Bâtir solide", sector: "btp", audience: ["professionnels"], values: ["fiabilite", "securite", "qualite"], style: "audacieux", preferredColors: ["jaune"], avoidedColors: ["rose"] },
  },
  {
    sectorLabel: "Beauté · Cotonou",
    pick: 1,
    brief: { name: "Beauté Divine", slogan: "Révélez votre éclat", sector: "beaute-mode", audience: ["particuliers"], values: ["elegance", "excellence", "creativite"], style: "elegant", preferredColors: ["rose"], avoidedColors: [] },
  },
  {
    sectorLabel: "Événementiel · Ouidah",
    pick: 3,
    brief: { name: "Ganvié Events", slogan: "Vos fêtes, notre passion", sector: "evenementiel", audience: ["particuliers", "professionnels"], values: ["creativite", "convivialite", "audace"], style: "ludique", preferredColors: ["violet"], avoidedColors: [] },
  },
  {
    sectorLabel: "École · Parakou",
    pick: 0,
    brief: { name: "Les Lauréats", slogan: "Apprendre pour réussir", sector: "education", audience: ["familles", "jeunes"], values: ["excellence", "fiabilite", "proximite"], style: "classique", preferredColors: ["bleu"], avoidedColors: [] },
  },
  {
    sectorLabel: "Commerce · Dantokpa",
    pick: 2,
    brief: { name: "Tokpa Market", sector: "commerce", audience: ["grand-public"], values: ["proximite", "rapidite", "simplicite"], style: "moderne", preferredColors: ["vert"], avoidedColors: [] },
  },
  {
    sectorLabel: "Conseil · Cotonou",
    pick: 4,
    brief: { name: "Sèmè Conseil", slogan: "Décider avec clarté", sector: "services-entreprises", audience: ["professionnels"], values: ["excellence", "innovation", "fiabilite"], style: "moderne", preferredColors: ["turquoise"], avoidedColors: [] },
  },
  {
    sectorLabel: "Boulangerie · Abomey",
    pick: 1,
    brief: { name: "Le Bon Pain", slogan: "Cuit chaque matin", sector: "restauration", audience: ["familles"], values: ["tradition", "qualite", "proximite"], style: "naturel", preferredColors: ["marron"], avoidedColors: [] },
  },
];

function build({ brief, sectorLabel, pick }: (typeof EXAMPLES)[number]): ShowcaseBrand {
  const seed = generationSeed(brief, 0);
  const palettes = generatePalettes(brief, seed);
  const logo = composeLogoProposals(brief, ruleBasedCreativeBrief(brief, seed), palettes, seed)[pick]!;
  return { brief, sectorLabel, logo, palette: palettes[pick % palettes.length]! };
}

export const SHOWCASE_BRANDS: ShowcaseBrand[] = EXAMPLES.map(build);
