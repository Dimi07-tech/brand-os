"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema } from "@brand-os/shared";
import { Alert, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { safeRedirect } from "@/lib/safe-redirect";
import { useForm } from "@/lib/use-form";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const form = useForm(loginSchema, { email: "", password: "" }, async (data) => {
    await api("/auth/login", { body: data });
    router.replace(safeRedirect(params.get("suite")));
  });

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {params.get("reinitialise") && (
          <Alert tone="success">Mot de passe modifié. Connectez-vous avec le nouveau.</Alert>
        )}
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...form.field("email")} />
        <div className="flex flex-col gap-2">
          <Field label="Mot de passe" type="password" autoComplete="current-password" {...form.field("password")} />
          <Link
            href="/mot-de-passe-oublie"
            className="self-end text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" loading={form.submitting}>
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-accent underline-offset-4 hover:underline">
          Créer ma marque gratuitement
        </Link>
      </p>
    </>
  );
}
