"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPasswordSchema } from "@brand-os/shared";
import { Alert, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { useForm } from "@/lib/use-form";

// US-03
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm(forgotPasswordSchema, { email: "" }, async (data) => {
    await api("/auth/forgot-password", { body: data });
    setSentTo(data.email);
  });

  if (sentTo) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Vérifiez vos e-mails</h1>
        <p className="mt-3 text-muted">
          Si un compte existe pour <strong className="text-foreground">{sentTo}</strong>, vous allez recevoir un lien
          pour choisir un nouveau mot de passe. Il est valable 30 minutes.
        </p>
        <p className="mt-3 text-sm text-muted">Pensez à regarder dans les courriers indésirables.</p>
        <Link href="/connexion" className="mt-8 font-semibold text-accent underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-2 text-muted">Indiquez votre adresse e-mail, nous vous envoyons un lien.</p>
      <form onSubmit={form.handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...form.field("email")} />
        <Button type="submit" loading={form.submitting}>
          Envoyer le lien
        </Button>
      </form>
      <Link href="/connexion" className="mt-6 text-center text-sm font-medium text-accent underline-offset-4 hover:underline">
        Retour à la connexion
      </Link>
    </>
  );
}
