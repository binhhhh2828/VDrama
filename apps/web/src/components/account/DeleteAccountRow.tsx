"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon, UserBanIcon } from "@/components/ui/icons";
import { Field } from "@/components/ui/Field";

/**
 * Hàng "Delete account" (ảnh 20) và hộp xác nhận bắt nhập mật khẩu. PREVIEW: API chưa có xóa tài khoản
 * nên nút xóa bị tắt, không gửi gì đi, không bao giờ báo "đã xóa".
 */
export function DeleteAccountRow() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3.5 px-1 text-left text-[22px] text-fg"
      >
        <UserBanIcon size={24} />
        <span className="min-w-0 flex-1 truncate">Delete account</span>
        <ChevronRightIcon size={18} className="shrink-0 text-muted" />
      </button>
      <dialog
        ref={ref}
        aria-label="Delete account"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto w-[calc(100%-32px)] max-w-[400px] rounded-[20px] border border-line bg-surface p-5 text-fg backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-3">
          <Badge kind="preview" className="self-start" />
          <h2 className="text-xl font-semibold">Delete your account?</h2>
          <p className="text-sm leading-6 text-fg-soft">
            This would permanently remove your account, your list and your watch history. Deleting
            accounts isn&apos;t available yet, so nothing will happen if you continue.
          </p>
          <Field
            id="delete-password"
            label="Confirm with your password"
            type="password"
            autoComplete="current-password"
            disabled
          />
          <div className="mt-1 flex justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled>
              Delete account
            </Button>
          </div>
        </div>
      </dialog>
    </li>
  );
}
