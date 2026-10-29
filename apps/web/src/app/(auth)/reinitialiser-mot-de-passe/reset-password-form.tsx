"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from "@brand-os/shared";
import { Alert, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { useForm } from "@/lib/use-form";

// US-03, RG-03
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const form = useForm(resetPasswordSchema, { token, password: "" }, async (data) => {
    await api("/auth/reset-password", { body: data });
    router.replace("/connexion?reinitialise=1");
  });

  if (!token) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <Alert>Ce lien est incomplet. Ouvrez le lien reçu par e-mail, ou faites une nouvelle demande.</Alert>
        <Link href="/mot-de-passe-oublie" className="font-semibold text-accent underline-offset-4 hover:underline">
          Faire une nouvelle demande
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
      {form.formError && (
        <Alert>
          {form.formError}{" "}
          <Link href="/mot-de-passe-oublie" className="font-semibold underline">
            Faire une nouvelle demande
          </Link>
        </Alert>
      )}
      <Field
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères. Vous serez déconnecté de tous vos appareils.`}
        {...form.field("password")}
      />
      <Button type="submit" loading={form.submitting}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
