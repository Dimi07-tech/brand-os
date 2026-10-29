import type { NextConfig } from "next";

// L'API est servie sous le même domaine que le site (/api/v1/*) : le cookie de
// session reste HttpOnly sur ce domaine, sans CORS côté navigateur.
const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Les pages connectées chargent leurs données côté client (SessionProvider) :
    // la validation « navigation instantanée » ne s'applique qu'aux segments qui
    // exportent `instant`. À revoir avec le rendu serveur des pages connectées.
    instantInsights: { validationLevel: "manual-warning" },
  },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiInternalUrl}/api/v1/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
