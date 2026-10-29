"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { api, ApiError, setActiveOrganization, type Organization, type User } from "./api";

interface SessionValue {
  user: User;
  /** Organisation active ; null tant que l'entreprise n'est pas créée. */
  organization: Organization | null;
  refresh: () => Promise<void>;
  setOrganization: (organization: Organization) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession doit être utilisé sous <SessionProvider>");
  return value;
}

/** Variante pour les écrans qui exigent une entreprise (garantie par SessionProvider). */
export function useOrganization(): Organization {
  const { organization } = useSession();
  if (!organization) throw new Error("Aucune organisation active");
  return organization;
}

const ONBOARDING_PATH = "/bienvenue";

async function fetchSession(): Promise<{ user: User; organization: Organization | null }> {
  const [{ user }, { organizations }] = await Promise.all([
    api<{ user: User }>("/auth/me"),
    api<{ organizations: Organization[] }>("/organizations"),
  ]);
  const organization = organizations[0] ?? null;
  setActiveOrganization(organization?.id ?? null);
  return { user, organization };
}

/**
 * Charge l'utilisateur et son entreprise, et oriente :
 * session invalide → connexion ; pas encore d'entreprise → accueil (onboarding).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ user: User; organization: Organization | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        router.replace(`/connexion?suite=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    },
    [router, pathname],
  );

  const load = useCallback(
    () =>
      fetchSession().then((data) => {
        setState(data);
        setError(null);
      }, handleError),
    [handleError],
  );

  useEffect(() => {
    // Chargement unique ; refresh() permet de recharger après une modification.
    fetchSession().then(setState, handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsOnboarding = state !== null && state.organization === null && pathname !== ONBOARDING_PATH;
  useEffect(() => {
    if (needsOnboarding) router.replace(ONBOARDING_PATH);
  }, [needsOnboarding, router]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p>{error}</p>
          <button className="font-semibold text-accent underline" onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!state || needsOnboarding) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted" role="status" aria-label="Chargement">
        <Spinner />
      </div>
    );
  }

  return (
    <SessionContext.Provider
      value={{
        ...state,
        refresh: load,
        setOrganization: (organization) => {
          setActiveOrganization(organization.id);
          setState((s) => (s ? { ...s, organization } : s));
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
