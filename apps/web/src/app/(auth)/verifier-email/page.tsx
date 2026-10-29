import { Suspense } from "react";
import { VerifyEmail } from "./verify-email";

export const metadata = { title: "Vérification de l’e-mail · Brand OS" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
