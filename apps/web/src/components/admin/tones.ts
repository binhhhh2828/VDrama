// Màu trạng thái dùng chung trong admin.

export function paymentTone(status: string): "green" | "amber" | "red" | "gray" {
  switch (status) {
    case "paid":
      return "green";
    case "pending":
      return "amber";
    case "failed":
      return "red";
    default:
      return "gray"; // expired, refunded
  }
}

export function streamTone(status: string | null): "green" | "amber" | "red" | "gray" {
  switch (status) {
    case "ready":
      return "green";
    case "uploading":
    case "processing":
      return "amber";
    case "error":
      return "red";
    default:
      return "gray";
  }
}
