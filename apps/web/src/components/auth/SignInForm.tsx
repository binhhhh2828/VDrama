"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { FormAlert } from "./AuthTabs";
import { useTerms } from "./AuthFlow";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";

export function SignInForm({ next }: { next: string }) {
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terms = useTerms();
  useRedirectIfSignedIn(next);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!terms.check()) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await api.login({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      session.setUser(user);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Couldn't sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false} className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Field
        id="signin-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
      />
      <Field
        id="signin-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="h-[52px]">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
