"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { formatDate, formatVnd } from "@/lib/format";
import {
  PREVIEW_ADMIN_PLANS,
  PREVIEW_PAYMENTS,
  PREVIEW_USERS,
  type PreviewUser,
} from "@/lib/preview-data";
import { DetailList, FilterChips, inputClass, MasterDetail, ReasonAction, SearchBox } from "./kit";
import { AdminHeader, Panel, rowClass, StatusPill, TableWrap, td, th } from "./ui";
import { paymentTone } from "./tones";

type Filter = "all" | "vip" | "free" | "disabled" | "admin";

const isVip = (u: PreviewUser) => u.vipUntil !== null;

const FILTERS: Record<Filter, (u: PreviewUser) => boolean> = {
  all: () => true,
  vip: isVip,
  free: (u) => !isVip(u) && u.role === "user",
  disabled: (u) => u.status === "disabled",
  admin: (u) => u.role === "admin",
};

/** PREVIEW quản lý người dùng: dữ liệu mẫu, lọc tại chỗ, thao tác cần lý do và đang tắt. */
export function UsersAdmin() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PREVIEW_USERS.filter(
      (u) =>
        FILTERS[filter](u) &&
        (!term || u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)),
    );
  }, [q, filter]);

  const user = PREVIEW_USERS.find((u) => u.id === selected) ?? null;
  const count = (f: Filter) => PREVIEW_USERS.filter(FILTERS[f]).length;

  return (
    <>
      <AdminHeader
        title="Users"
        text="Find an account, check VIP and payments, grant VIP or disable it."
      />
      <div className="flex flex-col gap-5">
        <PreviewNotice>
          These accounts are sample data. Searching real users and the actions below need the admin
          API (Phase 4).
        </PreviewNotice>
        <MasterDetail
          title={user ? user.name : "User"}
          selectedKey={selected}
          onClose={() => setSelected(null)}
          list={
            <Panel>
              <SearchBox value={q} onChange={setQ} label="Search by email or name" />
              <FilterChips
                label="Filter users"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: count("all") },
                  { value: "vip", label: "VIP", count: count("vip") },
                  { value: "free", label: "Free", count: count("free") },
                  { value: "disabled", label: "Disabled", count: count("disabled") },
                  { value: "admin", label: "Admins", count: count("admin") },
                ]}
              />
              <TableWrap>
                <thead>
                  <tr>
                    <th className={th}>User</th>
                    <th className={th}>VIP</th>
                    <th className={th}>Status</th>
                    <th className={th}>Joined</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u.id)}
                      className={rowClass(u.id === selected)}
                    >
                      <td className={td}>
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {u.name}
                            {u.role === "admin" ? (
                              <span className="ml-2 align-middle">
                                <StatusPill tone="pink">Admin</StatusPill>
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted">{u.email}</span>
                        </div>
                      </td>
                      <td className={td}>
                        {u.vipUntil ? (
                          <StatusPill tone="amber">Until {formatDate(u.vipUntil)}</StatusPill>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                      <td className={td}>
                        <StatusPill tone={u.status === "active" ? "green" : "red"}>
                          {u.status === "active" ? "Active" : "Disabled"}
                        </StatusPill>
                      </td>
                      <td className={`${td} text-fg-soft`}>{formatDate(u.joined)}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelected(u.id)}
                          aria-pressed={u.id === selected}
                          className="min-h-9 text-sm font-semibold text-link hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`${td} py-8 text-center text-muted`}>
                        No users match.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </TableWrap>
            </Panel>
          }
          detail={user ? <UserDetail key={user.id} user={user} /> : null}
        />
      </div>
    </>
  );
}

function UserDetail({ user }: { user: PreviewUser }) {
  const payments = PREVIEW_PAYMENTS.filter((p) => p.user === user.email);
  const disabled = user.status === "disabled";
  return (
    <>
      <Panel>
        <DetailList
          rows={[
            ["Email", user.email],
            ["User ID", `#${user.id}`],
            ["Role", user.role === "admin" ? "Admin" : "Viewer"],
            [
              "VIP",
              user.vipUntil ? (
                <StatusPill tone="amber">Until {formatDate(user.vipUntil)}</StatusPill>
              ) : (
                "Not VIP"
              ),
            ],
            [
              "Status",
              <StatusPill key="s" tone={disabled ? "red" : "green"}>
                {disabled ? "Disabled" : "Active"}
              </StatusPill>,
            ],
            ["Joined", formatDate(user.joined)],
            ["Last seen", user.lastSeen],
            ["Signed-in devices", String(user.devices)],
            ["Episodes watched", String(user.watched)],
          ]}
        />
      </Panel>

      <Panel title={`Payments (${payments.length})`}>
        {payments.length ? (
          <ul className="flex flex-col divide-y divide-line/60 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex flex-col">
                  <Link href={`/admin/payments?order=${p.orderCode}`} className="font-mono text-xs">
                    {p.orderCode}
                  </Link>
                  <span className="text-xs text-muted">
                    {p.plan} · {formatVnd(p.amountVnd)}
                  </span>
                </span>
                <StatusPill tone={paymentTone(p.status)}>{p.status}</StatusPill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No payments.</p>
        )}
      </Panel>

      <ReasonAction
        title="Grant VIP"
        actionLabel="Grant VIP"
        variant="vip"
        placeholder="e.g. Compensation for a failed payment"
        text={
          user.vipUntil
            ? `Adds days on top of the current VIP (until ${formatDate(user.vipUntil)}).`
            : "Gives VIP without a payment. It shows up in the audit log, not in revenue."
        }
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Length
          <select className={inputClass} defaultValue="monthly">
            {PREVIEW_ADMIN_PLANS.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.days} days)
              </option>
            ))}
          </select>
        </label>
      </ReasonAction>

      <ReasonAction
        danger={!disabled}
        title={disabled ? "Enable account" : "Disable account"}
        actionLabel={disabled ? "Enable account" : "Disable account"}
        variant={disabled ? "secondary" : "danger"}
        placeholder={disabled ? "e.g. Owner verified by email" : "e.g. Shared account reported"}
        text={
          disabled
            ? "Lets this person sign in again. Their VIP and history are unchanged."
            : "Signs this person out on every device and blocks sign-in. VIP time and history are kept."
        }
      />
    </>
  );
}
