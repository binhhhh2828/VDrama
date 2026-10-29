"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { formatVnd } from "@/lib/format";
import {
  PREVIEW_PAYMENTS,
  type PreviewPayment,
  type PreviewPaymentStatus,
} from "@/lib/preview-data";
import { DetailList, FilterChips, MasterDetail, ReasonAction, SearchBox } from "./kit";
import { AdminHeader, Panel, rowClass, StatusPill, TableWrap, td, th } from "./ui";
import { paymentTone } from "./tones";

type Filter = "all" | PreviewPaymentStatus;

const STATUS_TEXT: Record<PreviewPaymentStatus, string> = {
  pending: "Waiting for the bank transfer (the order expires after 15 minutes).",
  paid: "Matched to a bank transaction. VIP was added automatically.",
  failed: "A transfer arrived but didn't match the order. No VIP was added.",
  expired: "No transfer arrived in time.",
  refunded: "Money was returned and the VIP days were removed.",
};

const FAILURE_TEXT: Record<string, string> = {
  amount_mismatch: "Wrong amount",
  expired_unpaid: "Expired unpaid",
  duplicate_transfer: "Duplicate transfer",
  provider_error: "Payment provider error",
  refunded_by_admin: "Refunded by an admin",
  other: "Other",
};

/**
 * PREVIEW đơn thanh toán (SePay + VietQR): dữ liệu mẫu, lọc tại chỗ, hoàn tiền cần lý do.
 * `?order=MÃ` mở sẵn một đơn; đổi key theo mã để trang đã mở trước đó (Next giữ trong bộ nhớ)
 * vẫn chọn đúng đơn mới.
 */
export function PaymentsAdmin() {
  const order = useSearchParams().get("order") ?? "";
  return <Payments key={order} order={order} />;
}

function Payments({ order }: { order: string }) {
  const fromLink = PREVIEW_PAYMENTS.find((p) => p.orderCode === order);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(fromLink?.id ?? null);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PREVIEW_PAYMENTS.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (!term ||
          p.orderCode.toLowerCase().includes(term) ||
          p.user.toLowerCase().includes(term) ||
          (p.bankRef ?? "").toLowerCase().includes(term)),
    );
  }, [q, filter]);

  const payment = PREVIEW_PAYMENTS.find((p) => p.id === selected) ?? null;
  const count = (s: Filter) =>
    s === "all" ? PREVIEW_PAYMENTS.length : PREVIEW_PAYMENTS.filter((p) => p.status === s).length;
  const paidTotal = PREVIEW_PAYMENTS.filter((p) => p.status === "paid").reduce(
    (sum, p) => sum + p.amountVnd,
    0,
  );

  return (
    <>
      <AdminHeader
        title="Payments"
        text="VIP orders paid by bank transfer (VietQR). SePay tells us when the money arrives."
      />
      <div className="flex flex-col gap-5">
        <PreviewNotice>
          These orders are sample data. The payments API comes in Phase 5. An order only becomes
          paid when a matching bank transaction arrives; there is no button to mark it paid by hand.
        </PreviewNotice>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Paid (sample)" value={formatVnd(paidTotal)} />
          <Stat label="Paid orders" value={String(count("paid"))} />
          <Stat label="Waiting" value={String(count("pending"))} />
          <Stat label="Failed or expired" value={String(count("failed") + count("expired"))} />
        </div>

        <MasterDetail
          title={payment ? `Order ${payment.orderCode}` : "Order"}
          selectedKey={selected}
          onClose={() => setSelected(null)}
          list={
            <Panel>
              <SearchBox value={q} onChange={setQ} label="Order code, email or bank ref" />
              <FilterChips
                label="Filter by status"
                value={filter}
                onChange={setFilter}
                options={(["all", "paid", "pending", "failed", "expired", "refunded"] as const).map(
                  (s) => ({
                    value: s,
                    label: s === "all" ? "All" : s[0].toUpperCase() + s.slice(1),
                    count: count(s),
                  }),
                )}
              />
              <TableWrap>
                <thead>
                  <tr>
                    <th className={th}>Order</th>
                    <th className={th}>User</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Status</th>
                    <th className={th}>Created</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={rowClass(p.id === selected)}
                    >
                      <td className={td}>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-semibold">{p.orderCode}</span>
                          <span className="text-xs text-muted">{p.plan}</span>
                        </div>
                      </td>
                      <td className={`${td} text-fg-soft`}>{p.user}</td>
                      <td className={`${td} whitespace-nowrap`}>{formatVnd(p.amountVnd)}</td>
                      <td className={td}>
                        <StatusPill tone={paymentTone(p.status)}>{p.status}</StatusPill>
                      </td>
                      <td className={`${td} whitespace-nowrap text-fg-soft`}>{p.createdAt}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelected(p.id)}
                          aria-pressed={p.id === selected}
                          className="min-h-9 text-sm font-semibold text-link hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`${td} py-8 text-center text-muted`}>
                        No orders match.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </TableWrap>
            </Panel>
          }
          detail={payment ? <PaymentDetail key={payment.id} payment={payment} /> : null}
        />
      </div>
    </>
  );
}

function PaymentDetail({ payment: p }: { payment: PreviewPayment }) {
  return (
    <>
      <Panel>
        <div className="flex items-center gap-2.5">
          <StatusPill tone={paymentTone(p.status)}>{p.status}</StatusPill>
          <span className="text-sm text-fg-soft">{STATUS_TEXT[p.status]}</span>
        </div>
        <DetailList
          rows={[
            [
              "Order code",
              <span key="o" className="font-mono">
                {p.orderCode}
              </span>,
            ],
            ["Payment ID", `#${p.id}`],
            ["User", p.user],
            ["Plan", p.plan],
            ["Amount", formatVnd(p.amountVnd)],
            ["Method", "Bank transfer · SePay"],
            ["Created", p.createdAt],
            ["Paid", p.paidAt ?? "–"],
            [
              "Bank transaction",
              p.bankRef ? (
                <span key="b" className="font-mono">
                  {p.bankRef}
                </span>
              ) : (
                "–"
              ),
            ],
            ...(p.failureCode
              ? ([
                  ["Reason", FAILURE_TEXT[p.failureCode] ?? p.failureCode],
                  ["Detail", p.failureDetail ?? "–"],
                ] as [string, string][])
              : []),
          ]}
        />
      </Panel>
      {p.status === "paid" ? (
        <ReasonAction
          danger
          title="Refund"
          variant="danger"
          actionLabel={`Refund ${formatVnd(p.amountVnd)}`}
          placeholder="e.g. Charged twice by the bank"
          text="Marks the order refunded and removes the VIP days it added. Send the money back from the bank first; this does not move money."
        />
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-extrabold">{value}</span>
    </div>
  );
}
