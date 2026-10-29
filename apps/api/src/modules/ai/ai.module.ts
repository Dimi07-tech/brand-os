import { Module } from '@nestjs/common';
import { CreativeDirector, RuleBasedCreativeDirector } from './creative-director.js';

@Module({
  // Fournisseur IA à brancher ici après comparaison qualité/prix (§12.6).
  providers: [{ provide: CreativeDirector, useClass: RuleBasedCreativeDirector }],
  exports: [CreativeDirector],
})
export class AiModule {}
