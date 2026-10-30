"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useSession } from "@/components/session/SessionProvider";
import { useVipSheet } from "@/components/vip/VipSheetProvider";
import { ArrowUpIcon, CloseIcon } from "@/components/ui/icons";
import { useT } from "@/components/i18n/I18nProvider";
import { Link, usePathname } from "@/components/i18n/navigation";

const DISMISS_KEY = "vdrama:vip-bar-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Góc dưới màn hình (ảnh 02): thanh mời "Get VIP" dính đáy (NetShort mời tải app, VDrama chưa có app nên
 * mời VIP) và nút tròn lên đầu trang nổi ngay trên thanh. Tắt thanh bằng nút X (nhớ đến khi đóng tab);
 * thanh không hiện với người đã là VIP và ở trang VIP.
 */
export function FloatingDock() {
  const session = useSession();
  const t = useT();
  const pathname = usePathname();
  const vipSheet = useVipSheet();
  // Mặc định ẩn đến khi đọc được trạng thái đã tắt, để không nháy thanh lên rồi biến mất.
  const [dismissed, setDismissed] = useState(true);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    // Đọc sessionStorage chỉ làm được sau khi gắn vào trang (server không có).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
    const update = () => setShowTop(window.scrollY > window.innerHeight * 0.6);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const isVip = session.status === "user" && session.user.is_vip;
  const showBar =
    !dismissed && session.status !== "loading" && !isVip && !pathname.startsWith("/vip");

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ ẩn trong lần xem này.
    }
  }

  if (!showBar && !showTop) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-end gap-2 px-[7px] pb-[max(7px,env(safe-area-inset-bottom))]">
      {showTop ? (
        <button
          type="button"
          aria-label={t("nav.backToTop")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="hit-44 pointer-events-auto relative mr-2.5 flex size-10 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-black/40"
        >
          <ArrowUpIcon size={22} strokeWidth={2.5} />
        </button>
      ) : null}
      {showBar ? (
        <div
          role="complementary"
          aria-label={t("promo.getVip")}
          className="pointer-events-auto flex h-[52px] w-full max-w-[520px] items-center gap-2 self-center rounded-xl bg-promo pr-1 pl-2.5 text-ink shadow-lg shadow-black/40"
        >
          <Logo variant="icon" height={28} className="size-7 shrink-0 rounded-md" />
          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-tight">
            {t("promo.getVipLine")}
          </span>
          <Link
            href="/vip"
            // Mở bảng VIP ngay trên trang đang xem; link /vip vẫn dùng được khi chưa có JS.
            onClick={(e) => {
              e.preventDefault();
              vipSheet.open();
            }}
            className="hit-44 relative flex h-7 shrink-0 items-center rounded-tag bg-accent px-3 text-[15px] font-semibold text-on-accent no-underline hover:text-on-accent"
          >
            {t("promo.getVip")}
          </Link>
          <button
            type="button"
            aria-label={t("promo.dismiss")}
            onClick={dismiss}
            className="flex size-11 shrink-0 items-center justify-center text-ink/55 hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
