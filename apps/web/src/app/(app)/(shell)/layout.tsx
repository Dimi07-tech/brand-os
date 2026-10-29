"use client";

import { FileText, House, Palette, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { useOrganization } from "@/lib/session";

// Navigation principale §5.4 : barre d'onglets en bas sur mobile, latérale sur ordinateur.
const NAV = [
  { href: "/tableau-de-bord", label: "Accueil", icon: House },
  { href: "/ma-marque", label: "Ma marque", icon: Palette },
  { href: "/creer", label: "Créer", icon: Plus },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export default function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const organization = useOrganization();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-border bg-surface p-5 md:flex">
        <Wordmark />
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:px-8">
          <span className="md:hidden">
            <Wordmark />
          </span>
          <span className="truncate text-sm font-medium text-muted">{organization.name}</span>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
