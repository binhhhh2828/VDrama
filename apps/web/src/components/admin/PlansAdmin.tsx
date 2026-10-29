"use client";

import { useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { formatVnd } from "@/lib/format";
import { PREVIEW_ADMIN_PLANS, type PreviewAdminPlan } from "@/lib/preview-data";
import { DetailList, inputClass, MasterDetail, ReasonAction } from "./kit";
import { AdminHeader, Panel, rowClass, StatusPill, TableWrap, td, th } from "./ui";

const NEW = "new";

/** PREVIEW gói VIP: dữ liệu mẫu (giá giống trang /vip), sửa / ngừng bán cần lý do và đang tắt. */
export function PlansAdmin() {
  const [selected, setSelected] = useState<string | null>(null);
  const plan = PREVIEW_ADMIN_PLANS.find((p) => p.id === selected) ?? null;

  return (
    <>
      <AdminHeader
        title="VIP plans"
        text="What viewers can buy on the VIP page. Prices are in VND for bank transfer."
        actions={
          <Button size="sm" onClick={() => setSelected(NEW)}>
            <PlusIcon size={16} /> New plan
          </Button>
        }
      />
      <div className="flex flex-col gap-5">
        <PreviewNotice>
          Plans and numbers here are sample data that match the VIP page. Editing plans needs the
          admin API (Phase 4). A price change only affects new orders.
        </PreviewNotice>
        <MasterDetail
          title={selected === NEW ? "New plan" : plan ? plan.name : "Plan"}
          selectedKey={selected}
          onClose={() => setSelected(null)}
          list={
            <Panel>
              <TableWrap>
                <thead>
                  <tr>
                    <th className={th}>Plan</th>
                    <th className={th}>Price</th>
                    <th className={th}>On sale</th>
                    <th className={th}>Active VIP</th>
                    <th className={th}>Sold (30 days)</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_ADMIN_PLANS.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={rowClass(p.id === selected)}
                    >
                      <td className={td}>
                        <div className="flex flex-col">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-xs text-muted">{p.days} days</span>
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatVnd(p.priceVnd)}</td>
                      <td className={td}>
                        <StatusPill tone={p.active ? "green" : "gray"}>
                          {p.active ? "On sale" : "Retired"}
                        </StatusPill>
                      </td>
                      <td className={`${td} text-fg-soft`}>{p.activeSubs}</td>
                      <td className={`${td} text-fg-soft`}>{p.sold30d}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelected(p.id)}
                          aria-pressed={p.id === selected}
                          className="min-h-9 text-sm font-semibold text-link hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <p className="text-xs text-muted">
                Plans are never deleted: a retired plan stays attached to the orders that used it.
              </p>
            </Panel>
          }
          detail={
            selected === NEW ? (
              <PlanForm key={NEW} />
            ) : plan ? (
              <PlanForm key={plan.id} plan={plan} />
            ) : null
          }
        />
      </div>
    </>
  );
}

function PlanForm({ plan }: { plan?: PreviewAdminPlan }) {
  return (
    <>
      {plan ? (
        <Panel>
          <DetailList
            rows={[
              ["Active VIP on this plan", String(plan.activeSubs)],
              ["Sold in 30 days", String(plan.sold30d)],
              ["Revenue in 30 days", formatVnd(plan.sold30d * plan.priceVnd)],
            ]}
          />
        </Panel>
      ) : null}
      <ReasonAction
        title={plan ? "Edit plan" : "Create plan"}
        actionLabel={plan ? "Save changes" : "Create plan"}
        variant="primary"
        placeholder={plan ? "e.g. New year price" : "e.g. Summer offer"}
        text={
          plan
            ? "Viewers who already paid keep what they bought. New orders use the new price."
            : "The plan appears on the VIP page as soon as it is on sale."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
            Name
            <input className={inputClass} defaultValue={plan?.name ?? ""} placeholder="6 months" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Price (VND)
            <input
              className={inputClass}
              type="number"
              min={1000}
              step={1000}
              defaultValue={plan?.priceVnd ?? ""}
              placeholder="499000"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Length (days)
            <input
              className={inputClass}
              type="number"
              min={1}
              defaultValue={plan?.days ?? ""}
              placeholder="180"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-soft sm:col-span-2">
            <input
              type="checkbox"
              defaultChecked={plan?.active ?? true}
              className="size-4 accent-accent"
            />
            On sale (shown on the VIP page)
          </label>
        </div>
      </ReasonAction>
    </>
  );
}
