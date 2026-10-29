import { z } from 'zod';

// Messages de validation par défaut en français (API et interface).
z.config(z.locales.fr());

export * from './permissions.js';
export * from './plans.js';
export * from './schemas/auth.js';
export * from './schemas/organization.js';
export * from './schemas/brand.js';
export * from './schemas/design.js';
export * from './schemas/documents.js';
export * from './brand/index.js';
export * from './cards/index.js';
export * from './documents/index.js';
