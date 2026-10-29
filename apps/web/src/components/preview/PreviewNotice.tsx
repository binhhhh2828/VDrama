import { Badge } from "@/components/ui/Badge";
import { InfoIcon } from "@/components/ui/icons";

/**
 * Nhãn cho màn hình chưa nối API (giao diện tĩnh để demo). Bắt buộc ở mọi màn hình Preview,
 * để không ai tưởng chức năng đã chạy thật (docs/design.md, mục "Màn hình Preview").
 */
export function PreviewNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-input border border-vip/35 bg-vip/8 px-4 py-3 text-sm text-fg-soft"
    >
      <InfoIcon size={18} className="mt-0.5 shrink-0 text-vip" />
      <div className="flex flex-col gap-1.5">
        <Badge kind="preview" className="self-start" />
        <p>{children}</p>
      </div>
    </div>
  );
}
