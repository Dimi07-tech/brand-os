import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion · Brand OS" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-2 text-muted">Retrouvez votre marque et vos documents.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
