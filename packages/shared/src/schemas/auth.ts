import { z } from 'zod';

// Comptes et authentification — §4.1

/** RG-01 : 10 caractères minimum (la vérification « mot de passe compromis » est faite par l'API). */
export const PASSWORD_MIN_LENGTH = 10;

const email = z.email('Adresse e-mail invalide').trim().toLowerCase().max(254);

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(80),
  email,
  password: newPassword,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Indiquez votre mot de passe').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenSchema = z.object({
  token: z.string().min(20).max(200),
});
export type TokenInput = z.infer<typeof tokenSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = tokenSchema.extend({ password: newPassword });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Confirmez avec votre mot de passe').max(128),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
