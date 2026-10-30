"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { api } from "@/lib/api/client";
import { useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText, fieldErrorText } from "@/lib/i18n/api-errors";
import type { T } from "@/lib/i18n/translate";
import { FormAlert } from "./AuthTabs";
import { useTerms } from "./AuthFlow";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";
import { useRouter } from "@/components/i18n/navigation";

type Errors = Partial<Record<"display_name" | "email" | "password", string>>;

const PASSWORD_MIN = 8;

/** Kiểm tra nhanh trên trình duyệt (API vẫn kiểm tra lại đầy đủ). */
function validate(v: { name: string; email: string; password: string }, t: T): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.display_name = t("auth.nameRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    errors.email = t("fieldErrors.emailInvalid");
  if (v.password.length < PASSWORD_MIN) errors.password = t("fieldErrors.passwordShort");
  else if (v.password.trim().toLowerCase() === v.email.trim().toLowerCase())
    errors.password = t("auth.passwordSameAsEmail");
  return errors;
}

export function SignUpForm({ next }: { next: string }) {
  const t = useT();
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const terms = useTerms();
  useRedirectIfSignedIn(next);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!terms.check()) return;
    const form = new FormData(e.currentTarget);
    const values = {
      name: String(form.get("display_name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const local = validate(values, t);
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) {
      // Đưa con trỏ tới ô lỗi đầu tiên.
      const first = Object.keys(local)[0];
      e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const user = await api.register({
        display_name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        accept_terms: true,
      });
      session.setUser(user);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setBusy(false);
      if (!(err instanceof ApiError)) {
        setFormError(t("auth.createFailed"));
        return;
      }
      if (err.code === "email_taken") {
        setErrors({ email: apiErrorText(err, t) });
      } else if (err.code === "validation_error" && err.fields.length) {
        const fieldErrors: Errors = {};
        for (const f of err.fields) {
          const key = f.field as keyof Errors;
          if (key in { display_name: 1, email: 1, password: 1 })
            fieldErrors[key] = fieldErrorText(f, t);
        }
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
        else setFormError(apiErrorText(err, t));
      } else {
        setFormError(apiErrorText(err, t));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field
        id="signup-name"
        name="display_name"
        label={t("auth.displayName")}
        autoComplete="nickname"
        maxLength={100}
        placeholder={t("auth.namePlaceholder")}
        error={errors.display_name}
      />
      <Field
        id="signup-email"
        name="email"
        label={t("auth.email")}
        type="email"
        autoComplete="email"
        placeholder={t("auth.emailPlaceholder")}
        error={errors.email}
      />
      <Field
        id="signup-password"
        name="password"
        label={t("auth.password")}
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint={t("auth.passwordHint", { n: PASSWORD_MIN })}
        error={errors.password}
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="h-[52px]">
        {busy ? t("auth.creating") : t("gate.createAccount")}
      </Button>
    </form>
  );
}
