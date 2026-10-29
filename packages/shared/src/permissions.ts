// Rôles et matrice des droits — cahier des charges §4.2.
// RG-10 : la vérification fait foi côté serveur ; le front ne s'en sert que pour l'affichage.

export const ROLES = [
  'OWNER',
  'ADMIN',
  'DESIGNER',
  'EDITOR',
  'ACCOUNTANT',
  'VIEWER',
  'EXTERNAL_CLIENT',
] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  'brand.edit',
  'design.create',
  'document.create',
  'members.manage',
  'subscription.manage',
  'brandKit.view',
  'organization.edit',
] as const;
export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<Action, readonly Role[]> = {
  'brand.edit': ['OWNER', 'ADMIN', 'DESIGNER'],
  'design.create': ['OWNER', 'ADMIN', 'DESIGNER', 'EDITOR'],
  'document.create': ['OWNER', 'ADMIN', 'ACCOUNTANT'],
  'members.manage': ['OWNER', 'ADMIN'],
  'subscription.manage': ['OWNER'],
  'brandKit.view': ['OWNER', 'ADMIN', 'DESIGNER', 'EDITOR', 'ACCOUNTANT', 'VIEWER'],
  // Hors matrice §4.2 : profil et informations légales de l'entreprise (US-10, US-11)
  'organization.edit': ['OWNER', 'ADMIN'],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[action].includes(role);
}
