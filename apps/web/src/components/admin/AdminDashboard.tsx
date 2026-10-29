"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { ButtonLink } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { PREVIEW_PAYMENTS, PREVIEW_STATS } from "@/lib/preview-data";
import { AdminHeader, Panel, StatusPill, TableWrap, td, th } from "./ui";
import { paymentTone } from "./tones";

/** Tổng quan admin. Số liệu là PREVIEW (chưa có API thống kê); số phim lấy từ catalog thật. */
export function AdminDashboard() {
  const [published, setPublished] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      let count = 0;
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const page = await api.listSeries({ limit: 50, cursor });
        count += page.items.length;
        if (!page.next_cursor) break;
        cursor = page.next_cursor;
      }
      if (active) setPublished(count);
    })().catch(() => active && setPublished(null));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <AdminHeader title="Overview" text="How VDrama is doing at a glance." />
      <div className="flex flex-col gap-5">
        <PreviewNotice>
          Numbers on this page are sample data. Live statistics need the admin API (Phase 4). The
          series count below is real.
        </PreviewNotice>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PREVIEW_STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
            >
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-2xl font-extrabold">{s.value}</span>
              <span className="text-xs text-success">{s.change}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Panel title="Content" actions={<StatusPill tone="green">LIVE DATA</StatusPill>}>
            <p className="text-4xl font-extrabold">{published ?? "–"}</p>
            <p className="text-sm text-muted">published series in the catalog</p>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink href="/admin/series" size="sm">
                Manage series
              </ButtonLink>
              <ButtonLink href="/admin/series/new" size="sm" variant="secondary">
                New series
              </ButtonLink>
            </div>
          </Panel>

          <Panel
            title="Latest payments"
            actions={
              <Link href="/admin/payments" className="text-sm font-semibold">
                See all
              </Link>
            }
          >
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>User</th>
                  <th className={th}>Plan</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {PREVIEW_PAYMENTS.slice(0, 4).map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-mono text-xs`}>
                      <Link href={`/admin/payments?order=${p.orderCode}`}>{p.orderCode}</Link>
                    </td>
                    <td className={td}>{p.user}</td>
                    <td className={td}>{p.plan}</td>
                    <td className={td}>
                      <StatusPill tone={paymentTone(p.status)}>{p.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Panel>
        </div>
      </div>
    </>
  );
}
