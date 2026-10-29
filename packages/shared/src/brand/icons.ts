// Bibliothèque d'icônes vectorielles des logos — Lucide (licence ISC, usage
// commercial autorisé, §9.3). Chaque icône est rattachée à des secteurs et à des
// valeurs, pour que le moteur de composition choisisse des symboles pertinents.
import {
  Anchor, Baby, Bike, BookOpen, Briefcase, Building2, CakeSlice, CalendarHeart, Camera, Car, ChartLine,
  ChefHat, Coffee, Compass, Crown, Croissant, Droplet, Dumbbell, Feather, Fish, Flame, Flower2, Gem, Gift,
  Globe, GraduationCap, Hammer, Handshake, HardHat, Heart, House, Key, Laptop, Leaf, Lightbulb, Mic,
  Mountain, Music, Package, Paintbrush, Palette, PartyPopper, Pencil, Pizza, Plane, Rocket, Ruler, School,
  Scissors, Shield, Shirt, ShoppingBag, Soup, Sparkles, Sprout, Star, Store, Sun, Tag, Target, Truck,
  UtensilsCrossed, Waves, Wheat, Wrench, Zap, type IconNode,
} from 'lucide';
import type { Sector } from '../schemas/organization.js';
import type { BrandValue } from './brief.js';

export interface IconDefinition {
  id: string;
  label: string;
  node: IconNode;
  sectors: readonly Sector[];
  values: readonly BrandValue[];
}

const icon = (
  id: string,
  label: string,
  node: IconNode,
  sectors: readonly Sector[],
  values: readonly BrandValue[] = [],
): IconDefinition => ({ id, label, node, sectors, values });

export const ICONS: readonly IconDefinition[] = [
  // Restauration et alimentation
  icon('utensils', 'Couverts', UtensilsCrossed, ['restauration'], ['convivialite']),
  icon('chef-hat', 'Toque', ChefHat, ['restauration'], ['qualite', 'excellence']),
  icon('coffee', 'Tasse', Coffee, ['restauration'], ['convivialite', 'proximite']),
  icon('soup', 'Bol', Soup, ['restauration'], ['tradition', 'authenticite']),
  icon('pizza', 'Pizza', Pizza, ['restauration'], ['convivialite']),
  icon('cake', 'Gâteau', CakeSlice, ['restauration', 'evenementiel'], ['creativite']),
  icon('croissant', 'Viennoiserie', Croissant, ['restauration'], ['tradition']),
  icon('fish', 'Poisson', Fish, ['restauration', 'commerce'], ['authenticite']),
  icon('wheat', 'Épi', Wheat, ['restauration', 'commerce'], ['tradition', 'authenticite', 'durabilite']),
  // Beauté et mode
  icon('scissors', 'Ciseaux', Scissors, ['beaute-mode'], ['creativite']),
  icon('sparkles', 'Éclat', Sparkles, ['beaute-mode', 'evenementiel'], ['elegance', 'creativite']),
  icon('gem', 'Pierre précieuse', Gem, ['beaute-mode', 'commerce'], ['elegance', 'excellence', 'qualite']),
  icon('shirt', 'Vêtement', Shirt, ['beaute-mode', 'commerce']),
  icon('flower', 'Fleur', Flower2, ['beaute-mode', 'evenementiel'], ['elegance', 'authenticite']),
  icon('droplet', 'Goutte', Droplet, ['beaute-mode'], ['simplicite', 'durabilite']),
  icon('feather', 'Plume', Feather, ['beaute-mode', 'education'], ['elegance', 'simplicite']),
  // Commerce
  icon('shopping-bag', 'Sac de courses', ShoppingBag, ['commerce'], ['proximite']),
  icon('store', 'Boutique', Store, ['commerce'], ['proximite', 'fiabilite']),
  icon('tag', 'Étiquette', Tag, ['commerce'], ['simplicite']),
  icon('package', 'Colis', Package, ['commerce', 'services-entreprises'], ['fiabilite', 'rapidite']),
  icon('truck', 'Camion', Truck, ['commerce', 'btp', 'services-entreprises'], ['rapidite', 'fiabilite']),
  icon('gift', 'Cadeau', Gift, ['commerce', 'evenementiel'], ['convivialite']),
  // BTP
  icon('hard-hat', 'Casque de chantier', HardHat, ['btp'], ['securite', 'fiabilite']),
  icon('building', 'Immeuble', Building2, ['btp', 'services-entreprises'], ['fiabilite', 'excellence']),
  icon('hammer', 'Marteau', Hammer, ['btp'], ['fiabilite', 'authenticite']),
  icon('ruler', 'Règle', Ruler, ['btp'], ['qualite']),
  icon('house', 'Maison', House, ['btp', 'services-entreprises'], ['proximite', 'securite']),
  icon('wrench', 'Clé', Wrench, ['btp', 'services-entreprises'], ['fiabilite', 'rapidite']),
  icon('key', 'Clé de porte', Key, ['btp', 'services-entreprises'], ['securite']),
  // Services aux entreprises
  icon('briefcase', 'Mallette', Briefcase, ['services-entreprises'], ['fiabilite', 'excellence']),
  icon('handshake', 'Poignée de main', Handshake, ['services-entreprises'], ['proximite', 'fiabilite']),
  icon('chart', 'Croissance', ChartLine, ['services-entreprises'], ['excellence', 'innovation']),
  icon('target', 'Cible', Target, ['services-entreprises'], ['excellence', 'audace']),
  icon('laptop', 'Ordinateur', Laptop, ['services-entreprises', 'education'], ['innovation']),
  icon('lightbulb', 'Ampoule', Lightbulb, ['services-entreprises', 'education'], ['innovation', 'creativite']),
  // Éducation privée
  icon('graduation-cap', 'Toque de diplômé', GraduationCap, ['education'], ['excellence', 'qualite']),
  icon('book', 'Livre', BookOpen, ['education'], ['tradition', 'qualite']),
  icon('pencil', 'Crayon', Pencil, ['education'], ['creativite', 'simplicite']),
  icon('school', 'École', School, ['education'], ['fiabilite', 'proximite']),
  icon('baby', 'Enfant', Baby, ['education'], ['proximite', 'securite']),
  // Événementiel
  icon('party', 'Fête', PartyPopper, ['evenementiel'], ['convivialite', 'audace']),
  icon('music', 'Musique', Music, ['evenementiel'], ['convivialite', 'creativite']),
  icon('microphone', 'Micro', Mic, ['evenementiel'], ['audace']),
  icon('camera', 'Appareil photo', Camera, ['evenementiel', 'beaute-mode'], ['creativite']),
  icon('calendar-heart', 'Calendrier', CalendarHeart, ['evenementiel'], ['convivialite']),
  // Symboles génériques (valeurs, tous secteurs)
  icon('star', 'Étoile', Star, ['autre'], ['excellence', 'qualite']),
  icon('crown', 'Couronne', Crown, ['autre', 'beaute-mode'], ['excellence', 'elegance', 'tradition']),
  icon('heart', 'Cœur', Heart, ['autre'], ['proximite', 'convivialite']),
  icon('shield', 'Bouclier', Shield, ['autre', 'services-entreprises'], ['securite', 'fiabilite']),
  icon('zap', 'Éclair', Zap, ['autre'], ['rapidite', 'audace', 'innovation']),
  icon('rocket', 'Fusée', Rocket, ['autre'], ['innovation', 'audace', 'rapidite']),
  icon('leaf', 'Feuille', Leaf, ['autre'], ['durabilite', 'authenticite', 'simplicite']),
  icon('sprout', 'Pousse', Sprout, ['autre', 'education'], ['durabilite', 'innovation']),
  icon('sun', 'Soleil', Sun, ['autre'], ['convivialite', 'simplicite']),
  icon('mountain', 'Montagne', Mountain, ['autre', 'btp'], ['fiabilite', 'durabilite']),
  icon('waves', 'Vagues', Waves, ['autre'], ['simplicite', 'durabilite']),
  icon('globe', 'Globe', Globe, ['autre', 'services-entreprises'], ['innovation']),
  icon('compass', 'Boussole', Compass, ['autre'], ['fiabilite']),
  icon('anchor', 'Ancre', Anchor, ['autre'], ['tradition', 'fiabilite']),
  icon('flame', 'Flamme', Flame, ['autre', 'restauration'], ['audace', 'authenticite']),
  icon('palette', 'Palette', Palette, ['autre', 'evenementiel'], ['creativite']),
  icon('paintbrush', 'Pinceau', Paintbrush, ['autre', 'btp'], ['creativite']),
  icon('dumbbell', 'Haltère', Dumbbell, ['autre'], ['audace']),
  icon('bike', 'Vélo', Bike, ['autre', 'commerce'], ['rapidite', 'durabilite']),
  icon('car', 'Voiture', Car, ['autre', 'commerce'], ['rapidite']),
  icon('plane', 'Avion', Plane, ['autre', 'evenementiel'], ['rapidite', 'innovation']),
];

const BY_ID = new Map(ICONS.map((i) => [i.id, i]));

export function getIcon(id: string): IconDefinition | undefined {
  return BY_ID.get(id);
}

export function isKnownIcon(id: string): boolean {
  return BY_ID.has(id);
}
