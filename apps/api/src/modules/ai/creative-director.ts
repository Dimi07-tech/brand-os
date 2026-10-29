import { Injectable } from '@nestjs/common';
import { ruleBasedCreativeBrief, type BrandBrief, type CreativeBrief } from '@brand-os/shared';

/**
 * Couche d'abstraction IA — §8.3. Analyse du brief (§8.1, étape 1).
 * Changer de fournisseur = fournir une autre implémentation de ce jeton.
 * Toute implémentation à base de modèle de langage doit :
 * - traiter le brief comme des données, jamais comme des instructions (§8.5) ;
 * - valider sa sortie avec creativeBriefSchema avant de la renvoyer ;
 * - respecter un délai maximal de 30 secondes.
 */
export abstract class CreativeDirector {
  abstract analyze(brief: BrandBrief, seed: number): Promise<CreativeAnalysis>;
}

export interface CreativeAnalysis {
  creative: CreativeBrief;
  provider: string;
  model: string;
  /** Coût en millionièmes de FCFA, pour le suivi des coûts IA (§8.4). */
  costMicroXof: bigint;
}

/** Implémentation sans IA, à base de règles : gratuite, instantanée, déterministe. */
@Injectable()
export class RuleBasedCreativeDirector extends CreativeDirector {
  analyze(brief: BrandBrief, seed: number): Promise<CreativeAnalysis> {
    return Promise.resolve({
      creative: ruleBasedCreativeBrief(brief, seed),
      provider: 'rules',
      model: 'rules-v1',
      costMicroXof: 0n,
    });
  }
}
