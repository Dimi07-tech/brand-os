"use client";

import { useEffect, useState } from "react";
import { BrandFonts } from "@/components/logo-preview";
import { Alert, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Brand } from "@/lib/brand";
import { useOrganization } from "@/lib/session";
import { Studio } from "./studio";

// Brand Studio — §4.3
export default function BrandStudioPage() {
  const organization = useOrganization();
  const [state, setState] = useState<{ brand: Brand | null } | { error: string } | null>(null);

  useEffect(() => {
    api<{ brands: Brand[] }>("/brands").then(
      ({ brands }) => setState({ brand: brands[0] ?? null }),
      (err: Error) => setState({ error: err.message }),
    );
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <BrandFonts />
      {state === null ? (
        <div className="grid min-h-[40dvh] place-items-center text-muted" role="status" aria-label="Chargement">
          <Spinner />
        </div>
      ) : "error" in state ? (
        <Alert>{state.error}</Alert>
      ) : (
        <Studio existing={state.brand} organizationName={organization.name} organizationSector={organization.sector} />
      )}
    </div>
  );
}
