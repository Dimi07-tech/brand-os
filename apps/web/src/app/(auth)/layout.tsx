import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <Link href="/" className="self-start" aria-label="Brand OS, accueil">
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
    </div>
  );
}
