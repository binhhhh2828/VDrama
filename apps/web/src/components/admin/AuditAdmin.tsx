"use client";

import { useMemo, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { PREVIEW_AUDIT, type PreviewAudit } from "@/lib/preview-data";
import { DetailList, FilterChips, MasterDetail, SearchBox } from "./kit";
import { AdminHeader, Panel, rowClass, StatusPill, TableWrap, td, th } from "./ui";

type Who = "all" | PreviewAudit["actorType"];

const WHO_TONE = { admin: "pink", system: "gray", webhook: "amber" } as const;
const WHO_LABEL = { admin: "Admin", system: "System", webhook: "Webhook" } as const;

/** PREVIEW nhật ký thao tác (audit_logs): chỉ đọc, dữ liệu mẫu, lọc tại chỗ. */
export function AuditAdmin() {
  const [q, setQ] = useState("");
  const [who, setWho] = useState<Who>("all");
  const [selected, setSelected] = useState<number | null>(null);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PREVIEW_AUDIT.filter(
      (a) =>
        (who === "all" || a.actorType === who) &&
        (!term ||
          a.action.includes(term) ||
          a.target.toLowerCase().includes(term) ||
          a.actor.toLowerCase().includes(term)),
    );
  }, [q, who]);

  const entry = PREVIEW_AUDIT.find((a) => a.id === selected) ?? null;
  const count = (w: Who) =>
    w === "all" ? PREVIEW_AUDIT.length : PREVIEW_AUDIT.filter((a) => a.actorType === w).length;

  return (
    <>
      <AdminHeader
        title="Audit log"
        text="Every admin action, payment change and account change, with who did it and why."
      />
      <div className="flex flex-col gap-5">
        <PreviewNotice>
          These entries are sample data. The log itself is already written by the backend; reading
          it here needs the admin API (Phase 4). Entries can&apos;t be edited or deleted.
        </PreviewNotice>
        <MasterDetail
          title={entry ? entry.action : "Entry"}
          selectedKey={selected}
          onClose={() => setSelected(null)}
          list={
            <Panel>
              <SearchBox value={q} onChange={setQ} label="Action, target or person" />
              <FilterChips
                label="Filter by who"
                value={who}
                onChange={setWho}
                options={(["all", "admin", "system", "webhook"] as const).map((w) => ({
                  value: w,
                  label: w === "all" ? "Everyone" : WHO_LABEL[w],
                  count: count(w),
                }))}
              />
              <TableWrap>
                <thead>
                  <tr>
                    <th className={th}>Time</th>
                    <th className={th}>Who</th>
                    <th className={th}>Action</th>
                    <th className={th}>Target</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className={rowClass(a.id === selected)}
                    >
                      <td className={`${td} whitespace-nowrap text-fg-soft`}>{a.at}</td>
                      <td className={td}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill tone={WHO_TONE[a.actorType]}>
                            {WHO_LABEL[a.actorType]}
                          </StatusPill>
                          {a.actorType === "admin" ? (
                            <span className="text-xs text-muted">{a.actor}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${td} font-mono text-xs`}>{a.action}</td>
                      <td className={td}>
                        <div className="flex flex-col">
                          <span>{a.target}</span>
                          {a.reason ? (
                            <span className="text-xs text-muted">“{a.reason}”</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelected(a.id)}
                          aria-pressed={a.id === selected}
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
                        No entries match.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </TableWrap>
            </Panel>
          }
          detail={entry ? <AuditDetail entry={entry} /> : null}
        />
      </div>
    </>
  );
}

function AuditDetail({ entry: a }: { entry: PreviewAudit }) {
  return (
    <>
      <Panel>
        <DetailList
          rows={[
            ["Entry", `#${a.id}`],
            ["Time", a.at],
            ["Who", `${WHO_LABEL[a.actorType]}${a.actorType === "admin" ? ` · ${a.actor}` : ""}`],
            [
              "Action",
              <span key="a" className="font-mono text-xs">
                {a.action}
              </span>,
            ],
            ["Target", a.target],
            ["Reason", a.reason ?? "–"],
            [
              "Request ID",
              <span key="r" className="font-mono text-xs">
                {a.requestId}
              </span>,
            ],
          ]}
        />
      </Panel>
      <Panel title="What changed">
        <TableWrap narrow>
          <thead>
            <tr>
              <th className={th}>Field</th>
              <th className={th}>Before</th>
              <th className={th}>After</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(a.changes).map(([field, [before, after]]) => (
              <tr key={field}>
                <td className={`${td} font-mono text-xs`}>{field}</td>
                <td className={`${td} text-error-soft`}>{before ?? "null"}</td>
                <td className={`${td} text-success`}>{after ?? "null"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </>
  );
}
