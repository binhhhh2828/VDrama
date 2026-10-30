// Dữ liệu MẪU cho các màn hình chưa có API (nhãn PREVIEW). Không phải dữ liệu thật.
// Khi có API thì xóa phần tương ứng ở đây và nối màn hình vào API (xem docs/plans/gd3-frontend.md).

/** Gói VIP mẫu cho trang /vip. Giá thật lấy từ API gói ở Giai đoạn 5. */
export type PreviewPlan = {
  id: string;
  name: string;
  /** Số tháng của gói (để dịch tên gói: "1 month" / "1 tháng"). */
  months: number;
  days: number;
  priceUsd: string;
  /** Giá chuyển khoản trong nước (khớp gói mẫu của seed-demo). */
  priceVnd: number;
  period: string;
  note: string;
  featured?: boolean;
};

export const PREVIEW_PLANS: PreviewPlan[] = [
  {
    id: "monthly",
    name: "1 month",
    months: 1,
    days: 30,
    priceUsd: "$4.99",
    priceVnd: 99_000,
    period: "month",
    note: "30 days of VIP",
  },
  {
    id: "quarterly",
    name: "3 months",
    months: 3,
    days: 90,
    priceUsd: "$12.99",
    priceVnd: 259_000,
    period: "3 months",
    note: "90 days · save 13%",
    featured: true,
  },
  {
    id: "yearly",
    name: "12 months",
    months: 12,
    days: 365,
    priceUsd: "$44.99",
    priceVnd: 899_000,
    period: "year",
    note: "365 days · save 25%",
  },
];

export const VIP_PERKS = [
  "All VIP episodes, every series",
  "Full HD 1080p",
  "No ads",
  "New episodes the day they drop",
];

/** Thông tin chuyển khoản MẪU cho trang thanh toán. Không phải tài khoản thật. */
export const PREVIEW_TRANSFER = {
  bank: "Sample Bank (not a real account)",
  accountName: "VDRAMA DEMO",
  accountNumber: "0000 0000 0000",
  orderCode: "VD7K2QX9",
  expiresInSec: 15 * 60,
};

// --- Admin ---

export const PREVIEW_STATS = [
  { label: "Registered users", value: "1,284", change: "+38 this week" },
  { label: "Active VIP", value: "214", change: "+12 this week" },
  { label: "Revenue (30 days)", value: "21.4M VND", change: "+9% vs last month" },
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
  lastSeen: string;
  devices: number;
  watched: number;
};

export const PREVIEW_USERS: PreviewUser[] = [
  {
    id: 1031,
    email: "linh.tran@example.com",
    name: "Linh Tran",
    role: "user",
    vipUntil: "2027-01-27",
    status: "active",
    joined: "2026-10-02",
    lastSeen: "2026-10-29 09:20",
    devices: 2,
    watched: 64,
  },
  {
    id: 1030,
    email: "j.morales@example.com",
    name: "Jorge Morales",
    role: "user",
    vipUntil: null,
    status: "active",
    joined: "2026-10-01",
    lastSeen: "2026-10-29 08:55",
    devices: 1,
    watched: 12,
  },
  {
    id: 1029,
    email: "amelia.k@example.com",
    name: "Amelia K.",
    role: "user",
    vipUntil: "2027-10-28",
    status: "active",
    joined: "2026-09-28",
    lastSeen: "2026-10-28 22:41",
    devices: 2,
    watched: 131,
  },
  {
    id: 1028,
    email: "minh.nguyen@example.com",
    name: "Minh Nguyen",
    role: "user",
    vipUntil: null,
    status: "disabled",
    joined: "2026-09-27",
    lastSeen: "2026-10-27 10:30",
    devices: 0,
    watched: 48,
  },
  {
    id: 1027,
    email: "sarah.o@example.com",
    name: "Sarah O'Neil",
    role: "user",
    vipUntil: null,
    status: "active",
    joined: "2026-09-25",
    lastSeen: "2026-10-27 15:45",
    devices: 1,
    watched: 22,
  },
  {
    id: 1026,
    email: "kenji.w@example.com",
    name: "Kenji Watanabe",
    role: "user",
    vipUntil: "2026-11-24",
    status: "active",
    joined: "2026-09-20",
    lastSeen: "2026-10-26 20:12",
    devices: 1,
    watched: 37,
  },
  {
    id: 1001,
    email: "ops@example.com",
    name: "Ops Team",
    role: "admin",
    vipUntil: null,
    status: "active",
    joined: "2026-09-01",
    lastSeen: "2026-10-29 09:02",
    devices: 1,
    watched: 5,
  },
];

export type PreviewPaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

/** Khớp bảng `payments`: số tiền lưu bằng VND, đơn `paid` luôn gắn một giao dịch ngân hàng thật. */
export type PreviewPayment = {
  id: number;
  orderCode: string;
  user: string;
  plan: string;
  amountVnd: number;
  status: PreviewPaymentStatus;
  provider: "sepay";
  createdAt: string;
  paidAt: string | null;
  /** Mã giao dịch ngân hàng (SePay) đã khớp với đơn. */
  bankRef: string | null;
  failureCode: string | null;
  failureDetail: string | null;
};

export const PREVIEW_PAYMENTS: PreviewPayment[] = [
  {
    id: 512,
    orderCode: "VD7K2QX9",
    user: "linh.tran@example.com",
    plan: "3 months",
    amountVnd: 259_000,
    status: "paid",
    provider: "sepay",
    createdAt: "2026-10-29 09:14",
    paidAt: "2026-10-29 09:15",
    bankRef: "FT26302918830",
    failureCode: null,
    failureDetail: null,
  },
  {
    id: 511,
    orderCode: "VD3M8PL2",
    user: "j.morales@example.com",
    plan: "1 month",
    amountVnd: 99_000,
    status: "pending",
    provider: "sepay",
    createdAt: "2026-10-29 08:52",
    paidAt: null,
    bankRef: null,
    failureCode: null,
    failureDetail: null,
  },
  {
    id: 510,
    orderCode: "VD9Q1ZT4",
    user: "amelia.k@example.com",
    plan: "12 months",
    amountVnd: 899_000,
    status: "paid",
    provider: "sepay",
    createdAt: "2026-10-28 21:03",
    paidAt: "2026-10-28 21:05",
    bankRef: "FT26301774102",
    failureCode: null,
    failureDetail: null,
  },
  {
    id: 509,
    orderCode: "VD2B6RN7",
    user: "sarah.o@example.com",
    plan: "1 month",
    amountVnd: 99_000,
    status: "refunded",
    provider: "sepay",
    createdAt: "2026-10-27 15:40",
    paidAt: "2026-10-27 15:41",
    bankRef: "FT26300552871",
    failureCode: "refunded_by_admin",
    failureDetail: "Charged twice by the bank",
  },
  {
    id: 508,
    orderCode: "VD5H4WC1",
    user: "minh.nguyen@example.com",
    plan: "1 month",
    amountVnd: 99_000,
    status: "expired",
    provider: "sepay",
    createdAt: "2026-10-27 11:18",
    paidAt: null,
    bankRef: null,
    failureCode: "expired_unpaid",
    failureDetail: "No transfer within 15 minutes",
  },
  {
    id: 507,
    orderCode: "VD8T3YD6",
    user: "j.morales@example.com",
    plan: "1 month",
    amountVnd: 99_000,
    status: "failed",
    provider: "sepay",
    createdAt: "2026-10-26 19:25",
    paidAt: null,
    bankRef: "FT26299310457",
    failureCode: "amount_mismatch",
    failureDetail: "Received 90,000 VND, expected 99,000 VND",
  },
  {
    id: 506,
    orderCode: "VD4N7KS3",
    user: "kenji.w@example.com",
    plan: "1 month",
    amountVnd: 99_000,
    status: "paid",
    provider: "sepay",
    createdAt: "2026-10-25 20:10",
    paidAt: "2026-10-25 20:11",
    bankRef: "FT26298104466",
    failureCode: null,
    failureDetail: null,
  },
];

/** Gói VIP trong trang admin: gói đang bán (giống trang /vip) cộng một gói đã ngừng bán. */
export type PreviewAdminPlan = {
  id: string;
  name: string;
  days: number;
  priceVnd: number;
  active: boolean;
  activeSubs: number;
  sold30d: number;
};

export const PREVIEW_ADMIN_PLANS: PreviewAdminPlan[] = [
  ...PREVIEW_PLANS.map((p, i) => ({
    id: p.id,
    name: p.name,
    days: p.days,
    priceVnd: p.priceVnd,
    active: true,
    activeSubs: [88, 97, 29][i] ?? 0,
    sold30d: [61, 40, 11][i] ?? 0,
  })),
  {
    id: "weekly",
    name: "7 days (launch offer)",
    days: 7,
    priceVnd: 29_000,
    active: false,
    activeSubs: 0,
    sold30d: 0,
  },
];

export type PreviewAudit = {
  id: number;
  at: string;
  actorType: "admin" | "system" | "webhook";
  actor: string;
  action: string;
  target: string;
  reason: string | null;
  requestId: string;
  /** Trường đổi: [trước, sau] (snapshot trước/sau trong audit_logs). */
  changes: Record<string, [string | null, string | null]>;
};

export const PREVIEW_AUDIT: PreviewAudit[] = [
  {
    id: 9042,
    at: "2026-10-29 09:15",
    actorType: "webhook",
    actor: "SePay",
    action: "payments.mark_paid",
    target: "payment #512",
    reason: null,
    requestId: "a41f0c9e",
    changes: { status: ["pending", "paid"], paid_at: [null, "2026-10-29 09:15"] },
  },
  {
    id: 9041,
    at: "2026-10-29 09:15",
    actorType: "system",
    actor: "system",
    action: "subscriptions.create",
    target: "linh.tran@example.com",
    reason: "Payment #512",
    requestId: "a41f0c9e",
    changes: { vip_expires_at: [null, "2027-01-27"] },
  },
  {
    id: 9040,
    at: "2026-10-28 17:02",
    actorType: "admin",
    actor: "ops@example.com",
    action: "series.publish",
    target: "Faded Moonlight",
    reason: null,
    requestId: "7bd2e310",
    changes: { is_published: ["false", "true"] },
  },
  {
    id: 9039,
    at: "2026-10-27 16:10",
    actorType: "admin",
    actor: "ops@example.com",
    action: "payments.refund",
    target: "payment #509",
    reason: "Charged twice by the bank",
    requestId: "c09a55d4",
    changes: { status: ["paid", "refunded"] },
  },
  {
    id: 9038,
    at: "2026-10-27 11:33",
    actorType: "system",
    actor: "system",
    action: "payments.expire",
    target: "payment #508",
    reason: null,
    requestId: "job-expire",
    changes: { status: ["pending", "expired"] },
  },
  {
    id: 9037,
    at: "2026-10-27 10:44",
    actorType: "admin",
    actor: "ops@example.com",
    action: "users.disable",
    target: "minh.nguyen@example.com",
    reason: "Shared account reported",
    requestId: "5e8817af",
    changes: { is_active: ["true", "false"] },
  },
  {
    id: 9036,
    at: "2026-10-26 08:30",
    actorType: "admin",
    actor: "ops@example.com",
    action: "subscriptions.grant_vip",
    target: "amelia.k@example.com",
    reason: "Beta tester reward",
    requestId: "f2c4b871",
    changes: { vip_expires_at: ["2027-09-28", "2027-10-28"] },
  },
  {
    id: 9035,
    at: "2026-10-24 14:12",
    actorType: "admin",
    actor: "ops@example.com",
    action: "vip_plans.deactivate",
    target: "7 days (launch offer)",
    reason: "Launch offer ended",
    requestId: "0d6e2b93",
    changes: { is_active: ["true", "false"] },
  },
];
