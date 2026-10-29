import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nouveau mot de passe · Brand OS" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
