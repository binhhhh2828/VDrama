"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { api } from "@/lib/api/client";
import { useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText } from "@/lib/i18n/api-errors";
import { FormAlert } from "./AuthTabs";
import { useTerms } from "./AuthFlow";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";
import { useRouter } from "@/components/i18n/navigation";

export function SignInForm({ next }: { next: string }) {
  const t = useT();
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
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("auth.signInFailed"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false} className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Field
        id="signin-email"
        name="email"
        label={t("auth.email")}
        type="email"
        autoComplete="email"
        required
        placeholder={t("auth.emailPlaceholder")}
      />
      <Field
        id="signin-password"
        name="password"
        label={t("auth.password")}
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="h-[52px]">
        {busy ? t("auth.signingIn") : t("account.signIn")}
      </Button>
    </form>
  );
}
