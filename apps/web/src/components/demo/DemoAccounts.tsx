"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { api } from "@/lib/api/client";
import { useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText } from "@/lib/i18n/api-errors";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, IS_DEMO } from "@/lib/demo/config";
import { useRouter } from "@/components/i18n/navigation";

/** Khung "tài khoản demo" ở trang đăng nhập: bấm một dòng là đăng nhập luôn. Chỉ có ở bản demo. */
export function DemoAccounts({ next }: { next: string }) {
  const t = useT();
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!IS_DEMO) return null;

  async function signIn(email: string) {
    setBusy(email);
    setError(null);
    try {
      session.setUser(await api.login({ email, password: DEMO_PASSWORD }));
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("auth.signInFailed"));
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="demo-accounts-h"
      className="flex flex-col gap-3 rounded-card border border-vip/35 bg-vip/8 p-4"
    >
      <h2 id="demo-accounts-h" className="text-sm font-extrabold tracking-[0.08em] text-vip">
        {t("demoAccounts.title")}
      </h2>
      <p className="text-sm text-fg-soft">
        {t("demoAccounts.tap")}{" "}
        <code className="rounded bg-fg/10 px-1.5 py-0.5 font-mono text-fg">{DEMO_PASSWORD}</code>.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-error-soft">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => signIn(a.email)}
              className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 rounded-input border border-line bg-canvas px-4 py-2 text-left hover:border-vip/60 disabled:opacity-60"
            >
              <span className="text-[15px] font-bold text-fg">
                {busy === a.email ? t("auth.signingIn") : t(`demoAccounts.${a.id}`)}
                <span className="ml-2 font-normal text-muted">{a.email}</span>
              </span>
              <span className="text-xs text-muted">{t(`demoAccounts.${a.id}Note`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
