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

type Errors = Partial<Record<"display_name" | "email" | "password", string>>;

const PASSWORD_MIN = 8;

/** Kiểm tra nhanh trên trình duyệt (API vẫn kiểm tra lại đầy đủ). */
function validate(v: { name: string; email: string; password: string }): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.display_name = "Tell us what to call you.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    errors.email = "Enter a valid email address.";
  if (v.password.length < PASSWORD_MIN)
    errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (v.password.trim().toLowerCase() === v.email.trim().toLowerCase())
    errors.password = "Your password can't be the same as your email.";
  return errors;
}

export function SignUpForm({ next }: { next: string }) {
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
    const local = validate(values);
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
        setFormError("Couldn't create your account. Please try again.");
        return;
      }
      if (err.code === "email_taken") {
        setErrors({ email: err.userMessage });
      } else if (err.code === "validation_error" && err.fields.length) {
        const fieldErrors: Errors = {};
        for (const f of err.fields) {
          const key = f.field as keyof Errors;
          if (key in { display_name: 1, email: 1, password: 1 })
            fieldErrors[key] = err.fieldError(f.field);
        }
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
        else setFormError(err.userMessage);
      } else {
        setFormError(err.userMessage);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field
        id="signup-name"
        name="display_name"
        label="Display name"
        autoComplete="nickname"
        maxLength={100}
        placeholder="How we should call you"
        error={errors.display_name}
      />
      <Field
        id="signup-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email}
      />
      <Field
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={errors.password}
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="h-[52px]">
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
