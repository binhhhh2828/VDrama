import type { SVGProps } from "react";

/** Icon nét 24×24, màu theo `currentColor`. Luôn trang trí (aria-hidden); nghĩa nằm ở chữ hoặc aria-label của nút. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function PlayIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const CheckIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);

export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Stroke>
);

export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Stroke>
);

export const CrownIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 18h16M4 18 3 7l5 4 4-6 4 6 5-4-1 11" />
  </Stroke>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 5l7 7-7 7" />
  </Stroke>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);

export const UserIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Stroke>
);

export const HomeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Stroke>
);

export const GridIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Stroke>
);

export const BookmarkIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 4h12v17l-6-4-6 4z" />
  </Stroke>
);

export const HistoryIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Stroke>
);

export const TrashIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Stroke>
);

export const VolumeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </Stroke>
);

export const MuteIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </Stroke>
);

export const FullscreenIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Stroke>
);

export const NextIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 5l9 7-9 7zM18 5v14" />
  </Stroke>
);

export const InfoIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </Stroke>
);

export const LogOutIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4" />
  </Stroke>
);

/** Ngọn lửa đặc (nhãn HOT). */
export function FlameIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 2c1.2 3.6-1.3 5.4-2.9 7.6C7.9 11.3 6.5 13 6.5 15.5a5.5 5.5 0 0 0 11 0c0-2.6-1.4-4.6-2.8-6.2-.2 1.7-.9 2.7-2 3.2.8-3.3.6-6.9-.7-10.5Z" />
    </svg>
  );
}

export const MenuIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Stroke>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Stroke>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m6 9 6 6 6-6" />
  </Stroke>
);

/** Ô vuông có nút phát (mục Browse trong ngăn kéo). */
export const PlaySquareIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 8h18M10 11.5v5l4.5-2.5z" />
  </Stroke>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m6 15 6-6 6 6" />
  </Stroke>
);

/** Hai lớp chồng nhau (dải "All episodes"). */
export const LayersIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
  </Stroke>
);

export const LinkIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Stroke>
);

/** Hình trong hình (nút PiP của player). */
export const PipIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
    <rect x="13" y="13" width="8" height="6" rx="1.5" fill="currentColor" />
  </Stroke>
);

/** Trái tim đặc (lượt thích). */
export function HeartIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 21s-8-5.2-8-11.3A4.7 4.7 0 0 1 8.7 5c1.3 0 2.5.6 3.3 1.7A4.2 4.2 0 0 1 15.3 5 4.7 4.7 0 0 1 20 9.7C20 15.8 12 21 12 21Z" />
    </svg>
  );
}

/** Dấu trang đặc (lượt lưu). */
export function BookmarkFillIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

/** Ba thanh nhạc (tập đang phát). */
export function BarsIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <rect x="4" y="6" width="4" height="14" rx="1.5" />
      <rect x="10" y="3" width="4" height="17" rx="1.5" />
      <rect x="16" y="9" width="4" height="11" rx="1.5" />
    </svg>
  );
}

export function FacebookIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M13.5 22v-8h2.7l.5-3.2h-3.2V8.7c0-.9.4-1.7 1.8-1.7h1.5V4.2S15.6 4 14.4 4C11.9 4 10.2 5.5 10.2 8.2v2.6H7.5V14h2.7v8h3.3Z" />
    </svg>
  );
}

export function XIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.7L5.2 22H2l7.7-8.8L1.5 2h6.8l4.7 6.1L18.9 2Zm-1.2 18h1.8L7.3 3.9H5.4L17.7 20Z" />
    </svg>
  );
}

/** Cuộn phim có đuôi (mục Home trong ngăn kéo, ảnh 05). */
export const ReelIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11.5" cy="11.5" r="8.5" />
    <circle cx="11.5" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="7.4" cy="10.4" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.6" cy="10.4" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="16" r="1.1" fill="currentColor" stroke="none" />
    <path d="m17.5 17.5 3 3" />
  </Stroke>
);

/** Điện thoại có mũi tên tải xuống (mục Download). */
export const DownloadBoxIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M12 7.5v6M9.4 11.2l2.6 2.6 2.6-2.6M8.5 17.5h7" />
  </Stroke>
);

/** Tờ báo (mục News). */
export const NewsIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 3h8l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M8 11h7M8 15h4" />
  </Stroke>
);
