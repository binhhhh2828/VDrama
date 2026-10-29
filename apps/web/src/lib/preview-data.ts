// Dữ liệu MẪU cho các màn hình chưa có API (nhãn PREVIEW). Không phải dữ liệu thật.
// Khi có API thì xóa phần tương ứng ở đây và nối màn hình vào API (xem docs/plans/gd3-frontend.md).

/** Gói VIP mẫu cho trang /vip. Giá thật lấy từ API gói ở Giai đoạn 5. */
export type PreviewPlan = {
  id: string;
  name: string;
  priceUsd: string;
  period: string;
  note?: string;
  featured?: boolean;
};

export const PREVIEW_PLANS: PreviewPlan[] = [
  { id: "monthly", name: "Monthly", priceUsd: "$4.99", period: "/ month" },
  {
    id: "quarterly",
    name: "Quarterly",
    priceUsd: "$12.99",
    period: "/ 3 months",
    note: "Save 13%",
    featured: true,
  },
  { id: "yearly", name: "Yearly", priceUsd: "$44.99", period: "/ year", note: "Save 25%" },
];

export const VIP_PERKS = [
  "Every episode, including VIP-only ones",
  "Full HD streaming",
  "No ads",
  "Watch on up to 2 devices",
];

/** Thông tin chuyển khoản MẪU cho trang thanh toán. Không phải tài khoản thật. */
export const PREVIEW_TRANSFER = {
  bank: "Sample Bank",
  accountName: "VDRAMA DEMO",
  accountNumber: "0000 0000 0000",
  orderCode: "VD7K2QX9",
  expiresInSec: 15 * 60,
};

// --- Admin ---

export const PREVIEW_STATS = [
  { label: "Registered users", value: "1,284", change: "+38 this week" },
  { label: "Active VIP", value: "214", change: "+12 this week" },
  { label: "Revenue (30 days)", value: "$1,067", change: "+9% vs last month" },
  { label: "Episode views (30 days)", value: "48.2K", change: "+21% vs last month" },
];

export type PreviewUser = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  vipUntil: string | null;
  status: "active" | "disabled";
  joined: string;
};

export const PREVIEW_USERS: PreviewUser[] = [
  {
    id: 1031,
    email: "linh.tran@example.com",
    name: "Linh Tran",
    role: "user",
    vipUntil: "2026-12-14",
    status: "active",
    joined: "2026-10-02",
  },
  {
    id: 1030,
    email: "j.morales@example.com",
    name: "Jorge Morales",
    role: "user",
    vipUntil: null,
    status: "active",
    joined: "2026-10-01",
  },
  {
    id: 1029,
    email: "amelia.k@example.com",
    name: "Amelia K.",
    role: "user",
    vipUntil: "2027-03-02",
    status: "active",
    joined: "2026-09-28",
  },
  {
    id: 1028,
    email: "minh.nguyen@example.com",
    name: "Minh Nguyen",
    role: "user",
    vipUntil: null,
    status: "disabled",
    joined: "2026-09-27",
  },
  {
    id: 1027,
    email: "sarah.o@example.com",
    name: "Sarah O'Neil",
    role: "user",
    vipUntil: "2026-11-03",
    status: "active",
    joined: "2026-09-25",
  },
  {
    id: 1001,
    email: "ops@example.com",
    name: "Ops Team",
    role: "admin",
    vipUntil: null,
    status: "active",
    joined: "2026-09-01",
  },
];

export type PreviewPayment = {
  id: number;
  orderCode: string;
  user: string;
  plan: string;
  amount: string;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  provider: "sepay";
  createdAt: string;
};

export const PREVIEW_PAYMENTS: PreviewPayment[] = [
  {
    id: 512,
    orderCode: "VD7K2QX9",
    user: "linh.tran@example.com",
    plan: "Quarterly",
    amount: "$12.99",
    status: "paid",
    provider: "sepay",
    createdAt: "2026-10-29 09:14",
  },
  {
    id: 511,
    orderCode: "VD3M8PL2",
    user: "j.morales@example.com",
    plan: "Monthly",
    amount: "$4.99",
    status: "pending",
    provider: "sepay",
    createdAt: "2026-10-29 08:52",
  },
  {
    id: 510,
    orderCode: "VD9Q1ZT4",
    user: "amelia.k@example.com",
    plan: "Yearly",
    amount: "$44.99",
    status: "paid",
    provider: "sepay",
    createdAt: "2026-10-28 21:03",
  },
  {
    id: 509,
    orderCode: "VD2B6RN7",
    user: "sarah.o@example.com",
    plan: "Monthly",
    amount: "$4.99",
    status: "refunded",
    provider: "sepay",
    createdAt: "2026-10-27 15:40",
  },
  {
    id: 508,
    orderCode: "VD5H4WC1",
    user: "minh.nguyen@example.com",
    plan: "Monthly",
    amount: "$4.99",
    status: "expired",
    provider: "sepay",
    createdAt: "2026-10-27 11:18",
  },
  {
    id: 507,
    orderCode: "VD8T3YD6",
    user: "j.morales@example.com",
    plan: "Monthly",
    amount: "$4.99",
    status: "failed",
    provider: "sepay",
    createdAt: "2026-10-26 19:25",
  },
];

export type PreviewAudit = {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  reason: string | null;
};

export const PREVIEW_AUDIT: PreviewAudit[] = [
  {
    id: 9042,
    at: "2026-10-29 09:15",
    actor: "webhook",
    action: "payments.mark_paid",
    target: "payment #512",
    reason: null,
  },
  {
    id: 9041,
    at: "2026-10-29 09:15",
    actor: "system",
    action: "subscriptions.create",
    target: "linh.tran@example.com",
    reason: "Payment #512",
  },
  {
    id: 9040,
    at: "2026-10-28 17:02",
    actor: "ops@example.com",
    action: "series.publish",
    target: "Faded Moonlight",
    reason: null,
  },
  {
    id: 9039,
    at: "2026-10-27 16:10",
    actor: "ops@example.com",
    action: "payments.refund",
    target: "payment #509",
    reason: "Charged twice by the bank",
  },
  {
    id: 9038,
    at: "2026-10-27 10:44",
    actor: "ops@example.com",
    action: "users.disable",
    target: "minh.nguyen@example.com",
    reason: "Shared account reported",
  },
  {
    id: 9037,
    at: "2026-10-26 08:30",
    actor: "ops@example.com",
    action: "subscriptions.grant_vip",
    target: "amelia.k@example.com",
    reason: "Beta tester reward",
  },
];
