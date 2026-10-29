import { NextResponse, type NextRequest } from "next/server";

// Redirection rapide vers la connexion quand aucun cookie de session n'est
// présent. La validité réelle de la session est vérifiée par l'API.
const SESSION_COOKIES = ["session", "__Host-session"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = `?suite=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/bienvenue", "/tableau-de-bord/:path*", "/ma-marque/:path*", "/creer/:path*", "/documents/:path*", "/parametres/:path*"],
};
