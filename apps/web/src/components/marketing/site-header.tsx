"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, Wordmark } from "@/components/ui";

const LINKS = [
  { href: "#comment-ca-marche", label: "Comment ça marche" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#exemples", label: "Exemples" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "Questions" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled || open ? "bg-background/85 shadow-[0_1px_0_var(--border)] backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:h-20 2xl:max-w-[96rem]">
        <Link href="/" aria-label="Brand OS, accueil" onClick={() => setOpen(false)}>
          <Wordmark className="text-lg" />
        </Link>

        <nav aria-label="Navigation de la page" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/connexion" className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface">
            Se connecter
          </Link>
          <ButtonLink href="/inscription" className="rounded-full">
            Commencer gratuitement
          </ButtonLink>
        </div>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-full hover:bg-surface lg:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </div>

      {open && (
        <div id="menu-mobile" className="animate-fade-in border-t border-border bg-background px-4 pb-6 pt-2 lg:hidden">
          <nav aria-label="Navigation de la page" className="flex flex-col">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-border py-4 text-lg font-medium">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <ButtonLink href="/inscription" className="rounded-full">
              Commencer gratuitement
            </ButtonLink>
            <ButtonLink href="/connexion" variant="secondary" className="rounded-full">
              Se connecter
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
