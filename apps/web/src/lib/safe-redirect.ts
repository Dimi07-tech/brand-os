/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes (?suite=https://…). */
export function safeRedirect(target: string | null, fallback = "/tableau-de-bord"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
}
