"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CrownIcon, LogOutIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}

export function AccountOverview() {
  const session = useSession();
  const router = useRouter();
  if (session.status !== "user") return null;
  const { user } = session;
  const left = daysLeft(user.vip_expires_at);
  const expired = !user.is_vip && user.vip_expires_at !== null;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section
        aria-labelledby="profile-h"
        className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 md:p-6"
      >
        <h2 id="profile-h" className="text-lg font-extrabold">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-on-accent">
            {user.display_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.display_name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Member since</dt>
          <dd>{formatDate(user.created_at)}</dd>
          <dt className="text-muted">Email</dt>
          <dd>
            {user.email_verified ? (
              <span className="text-success">Verified</span>
            ) : (
              <>
                Not verified · <Link href="/verify-email">Verify email</Link>
              </>
            )}
          </dd>
          {user.role === "admin" ? (
            <>
              <dt className="text-muted">Role</dt>
              <dd>
                Admin · <Link href="/admin">Open admin</Link>
              </dd>
            </>
          ) : null}
        </dl>
        <div className="mt-auto flex flex-wrap gap-2.5">
          <ButtonLink href="/forgot-password" variant="secondary" size="sm">
            Change password
          </ButtonLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await session.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOutIcon size={18} /> Sign out
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="vip-h"
        className={
          user.is_vip
            ? "flex flex-col gap-4 rounded-panel border border-vip-line bg-vip-panel p-5 md:p-6"
            : "flex flex-col gap-4 rounded-panel border border-line bg-surface p-5 md:p-6"
        }
      >
        <div className="flex items-center gap-2.5">
          <CrownIcon size={22} className={user.is_vip ? "text-vip" : "text-muted"} />
          <h2 id="vip-h" className="text-lg font-extrabold">
            VIP membership
          </h2>
        </div>
        {user.is_vip ? (
          <>
            <p className="text-2xl font-extrabold text-vip">
              VIP until {formatDate(user.vip_expires_at)}
            </p>
            <p className="text-sm text-fg-soft">
              {left === 0
                ? "Your VIP ends today."
                : `${left} ${left === 1 ? "day" : "days"} left. Every episode is unlocked.`}{" "}
              Renewing early adds time on top. You never lose a day.
            </p>
            <ButtonLink href="/vip" variant="vip" size="sm" className="self-start">
              Extend VIP
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="text-xl font-extrabold">
              {expired
                ? `Your VIP ended on ${formatDate(user.vip_expires_at)}`
                : "You're on the free plan"}
            </p>
            <p className="text-sm text-fg-soft">
              Free accounts can watch the first episodes of every series. VIP unlocks every episode,
              ad-free, in Full HD.
            </p>
            <ButtonLink href="/vip" size="sm" className="self-start">
              {expired ? "Renew VIP" : "Get VIP"}
            </ButtonLink>
          </>
        )}
      </section>
    </div>
  );
}
