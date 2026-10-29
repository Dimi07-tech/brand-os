"use client";

import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { ApiError } from "./api";

/**
 * Formulaire validé par un schéma de @brand-os/shared (le même que l'API),
 * qui affiche aussi les erreurs renvoyées par le serveur, champ par champ.
 */
export function useForm<S extends z.ZodType<unknown, Record<string, unknown>>>(
  schema: S,
  initial: z.input<S>,
  onSubmit: (data: z.output<S>) => Promise<void>,
) {
  const [values, setValues] = useState<z.input<S>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field<K extends keyof z.input<S> & string>(name: K) {
    return {
      name,
      value: (values[name] ?? "") as string,
      error: errors[name],
      onChange: (e: { target: { value: string } }) => {
        setValues((v) => ({ ...v, [name]: e.target.value }));
        if (errors[name]) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
        }
      },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_form";
        next[key] ??= issue.message;
      }
      setErrors(next);
      if (next._form) setFormError(next._form);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length > 0) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])));
      } else {
        setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { values, setValues, field, errors, formError, setFormError, submitting, handleSubmit };
}
