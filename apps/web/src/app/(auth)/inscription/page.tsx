"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PASSWORD_MIN_LENGTH, registerSchema } from "@brand-os/shared";
import { Alert, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { useForm } from "@/lib/use-form";

// US-01
export default function RegisterPage() {
  const router = useRouter();
  const form = useForm(registerSchema, { name: "", email: "", password: "" }, async (data) => {
    await api("/auth/register", { body: data });
    router.replace("/bienvenue");
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Créer ma marque gratuitement</h1>
      <p className="mt-2 text-muted">Votre identité visuelle en quelques minutes, sans graphiste.</p>

      <form onSubmit={form.handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Votre nom" autoComplete="name" {...form.field("name")} />
        <Field label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...form.field("email")} />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères. Une phrase facile à retenir fonctionne bien.`}
          {...form.field("password")}
        />
        <Button type="submit" loading={form.submitting}>
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-accent underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
