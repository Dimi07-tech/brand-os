// Client de l'API Brand OS, appelé depuis le navigateur (même domaine, cookie HttpOnly).

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    /** Code métier, ex. QUOTA_EXCEEDED (RG-71). */
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Organisation active, envoyée à l'API pour les données d'une entreprise (TenantGuard). */
let activeOrganizationId: string | null = null;

export function setActiveOrganization(id: string | null): void {
  activeOrganizationId = id;
}

const NETWORK_ERROR =
  "Connexion impossible. Vérifiez votre accès à Internet, puis réessayez.";

export async function api<T = void>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(activeOrganizationId && { "X-Organization-Id": activeOrganizationId }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = (data ?? {}) as { message?: unknown; errors?: FieldError[]; code?: string };
    const message =
      typeof body.message === "string"
        ? body.message
        : res.status >= 500
          ? "Une erreur est survenue de notre côté. Réessayez dans un instant."
          : "La demande n’a pas pu aboutir.";
    throw new ApiError(res.status, message, body.errors ?? [], body.code);
  }
  return data as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  locale: string;
}

export interface Organization {
  id: string;
  name: string;
  sector: string;
  country: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rccm: string | null;
  ifu: string | null;
  taxRegime: string | null;
  vatEnabled: boolean;
  currency: "XOF" | "EUR" | "USD";
  role: string;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}
