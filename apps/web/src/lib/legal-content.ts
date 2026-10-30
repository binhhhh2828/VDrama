import type { Locale } from "@/lib/i18n/config";

// Nội dung KHUNG của ba trang pháp lý (docs/plans/gd4-i18n.md, mục 7): đề mục và phần giữ chỗ, chưa phải
// văn bản pháp lý. Bản tiếng Việt do VDrama soạn tham khảo, bản tiếng Anh là bản chuẩn; cả hai cần
// luật sư duyệt trước khi ra mắt. Thêm ngôn ngữ mới thì thêm một khối cùng cấu trúc.

export type LegalSectionData = {
  id: string;
  title: string;
  paragraphs?: string[];
  placeholder?: string;
};
export type LegalDoc = { title: string; intro: string; sections: LegalSectionData[] };
export type LegalKey = "terms" | "privacy" | "refunds";

const en: Record<LegalKey, LegalDoc> = {
  terms: {
    title: "Terms of Use",
    intro:
      "These terms explain the rules for using VDrama, including accounts, VIP plans and the content you watch.",
    sections: [
      {
        id: "accounts",
        title: "Your account",
        placeholder:
          "Who can create an account, keeping your password safe, one person per account, device limit",
      },
      {
        id: "content",
        title: "Watching content",
        placeholder:
          "Personal, non-commercial viewing only; no recording, re-uploading or sharing of episodes",
      },
      {
        id: "vip",
        title: "VIP plans and payments",
        placeholder:
          "Plan lengths, prices, no automatic renewal, how extensions stack, what happens when a plan ends",
      },
      {
        id: "conduct",
        title: "Acceptable use",
        placeholder: "Prohibited behaviour, account sharing, attempts to bypass access controls",
      },
      {
        id: "termination",
        title: "Suspension and closing accounts",
        placeholder: "When we may suspend an account and how you can close yours",
      },
      {
        id: "liability",
        title: "Liability and changes",
        placeholder:
          "Service availability, limitation of liability, how we announce changes to these terms",
      },
      {
        id: "law",
        title: "Governing law and contact",
        placeholder: "Governing law, the legal entity operating VDrama, contact details",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains what personal data VDrama collects, why, how long we keep it, and the choices you have.",
    sections: [
      {
        id: "collect",
        title: "What we collect",
        paragraphs: [
          "Today the service stores: your email and display name, your watch progress and history, the series in My List, VIP plan dates, and basic technical data (IP address, browser) for security.",
        ],
        placeholder: "Final wording, plus payment data handled by our payment provider",
      },
      {
        id: "use",
        title: "How we use it",
        placeholder:
          "Running your account, remembering progress, VIP access, security and fraud prevention, service analytics",
      },
      {
        id: "retention",
        title: "How long we keep it",
        paragraphs: [
          "When you remove an item from your history or My List, it is hidden from you straight away but kept in our records for service analytics.",
        ],
        placeholder:
          "Retention periods, and how full deletion or anonymisation works when you close your account",
      },
      {
        id: "sharing",
        title: "Who we share it with",
        placeholder: "Service providers: hosting, video delivery, payments, email",
      },
      {
        id: "rights",
        title: "Your rights",
        placeholder: "Access, correction, deletion, objection, and how to make a request",
      },
      {
        id: "cookies",
        title: "Cookies",
        paragraphs: [
          "We use only the cookies needed to keep you signed in securely. We do not use advertising cookies.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        placeholder: "Data protection contact and the legal entity responsible",
      },
    ],
  },
  refunds: {
    title: "Refund Policy",
    intro: "This policy explains when you can get your money back for a VIP plan and how to ask.",
    sections: [
      {
        id: "eligibility",
        title: "When refunds are possible",
        placeholder: "Eligible cases, e.g. charged twice, paid but VIP not activated, time limits",
      },
      {
        id: "wrong-transfer",
        title: "Wrong or partial transfers",
        placeholder:
          "Transfers with the wrong note, too little or too much money, and how they are handled",
      },
      {
        id: "how",
        title: "How to request a refund",
        placeholder: "Contact channel, information to include, response time",
      },
      {
        id: "processing",
        title: "How refunds are paid",
        placeholder: "Method and timing, what happens to the VIP days",
      },
    ],
  },
};

const vi: Record<LegalKey, LegalDoc> = {
  terms: {
    title: "Điều khoản sử dụng",
    intro:
      "Các điều khoản này giải thích quy tắc sử dụng VDrama, bao gồm tài khoản, gói VIP và nội dung bạn xem.",
    sections: [
      {
        id: "accounts",
        title: "Tài khoản của bạn",
        placeholder:
          "Ai được tạo tài khoản, giữ an toàn mật khẩu, mỗi người một tài khoản, giới hạn thiết bị",
      },
      {
        id: "content",
        title: "Xem nội dung",
        placeholder:
          "Chỉ xem cá nhân, phi thương mại; không ghi hình, đăng lại hay chia sẻ các tập phim",
      },
      {
        id: "vip",
        title: "Gói VIP và thanh toán",
        placeholder:
          "Thời hạn gói, giá, không tự động gia hạn, cách cộng dồn khi gia hạn, điều gì xảy ra khi gói hết hạn",
      },
      {
        id: "conduct",
        title: "Sử dụng được chấp nhận",
        placeholder: "Hành vi bị cấm, chia sẻ tài khoản, cố vượt qua kiểm soát truy cập",
      },
      {
        id: "termination",
        title: "Tạm khóa và đóng tài khoản",
        placeholder:
          "Khi nào chúng tôi có thể tạm khóa tài khoản và cách bạn đóng tài khoản của mình",
      },
      {
        id: "liability",
        title: "Trách nhiệm và thay đổi",
        placeholder:
          "Mức độ sẵn sàng của dịch vụ, giới hạn trách nhiệm, cách chúng tôi thông báo thay đổi các điều khoản này",
      },
      {
        id: "law",
        title: "Luật áp dụng và liên hệ",
        placeholder: "Luật áp dụng, pháp nhân vận hành VDrama, thông tin liên hệ",
      },
    ],
  },
  privacy: {
    title: "Chính sách bảo mật",
    intro:
      "Chính sách này giải thích VDrama thu thập dữ liệu cá nhân nào, vì sao, giữ bao lâu và bạn có những lựa chọn nào.",
    sections: [
      {
        id: "collect",
        title: "Chúng tôi thu thập gì",
        paragraphs: [
          "Hiện dịch vụ lưu: email và tên hiển thị của bạn, tiến độ và lịch sử xem, các phim trong Danh sách của tôi, ngày của gói VIP, và dữ liệu kỹ thuật cơ bản (địa chỉ IP, trình duyệt) phục vụ bảo mật.",
        ],
        placeholder: "Nội dung cuối cùng, kèm dữ liệu thanh toán do đối tác thanh toán xử lý",
      },
      {
        id: "use",
        title: "Chúng tôi dùng dữ liệu như thế nào",
        placeholder:
          "Vận hành tài khoản, ghi nhớ tiến độ, quyền VIP, bảo mật và phòng chống gian lận, phân tích dịch vụ",
      },
      {
        id: "retention",
        title: "Chúng tôi giữ bao lâu",
        paragraphs: [
          "Khi bạn xóa một mục khỏi lịch sử xem hoặc Danh sách của tôi, mục đó được ẩn ngay với bạn nhưng vẫn được giữ trong hồ sơ của chúng tôi để phân tích dịch vụ.",
        ],
        placeholder:
          "Thời hạn lưu giữ, và cách xóa hoàn toàn hoặc ẩn danh hóa khi bạn đóng tài khoản",
      },
      {
        id: "sharing",
        title: "Chúng tôi chia sẻ với ai",
        placeholder: "Nhà cung cấp dịch vụ: lưu trữ, phát video, thanh toán, email",
      },
      {
        id: "rights",
        title: "Quyền của bạn",
        placeholder: "Truy cập, chỉnh sửa, xóa, phản đối, và cách gửi yêu cầu",
      },
      {
        id: "cookies",
        title: "Cookie",
        paragraphs: [
          "Chúng tôi chỉ dùng cookie cần thiết để giữ bạn đăng nhập an toàn. Chúng tôi không dùng cookie quảng cáo.",
        ],
      },
      {
        id: "contact",
        title: "Liên hệ",
        placeholder: "Đầu mối bảo vệ dữ liệu và pháp nhân chịu trách nhiệm",
      },
    ],
  },
  refunds: {
    title: "Chính sách hoàn tiền",
    intro: "Chính sách này giải thích khi nào bạn được hoàn tiền cho gói VIP và cách yêu cầu.",
    sections: [
      {
        id: "eligibility",
        title: "Khi nào được hoàn tiền",
        placeholder:
          "Các trường hợp đủ điều kiện, ví dụ bị trừ tiền hai lần, đã thanh toán nhưng VIP chưa kích hoạt, giới hạn thời gian",
      },
      {
        id: "wrong-transfer",
        title: "Chuyển khoản sai hoặc thiếu",
        placeholder: "Chuyển khoản sai nội dung, thiếu hoặc thừa tiền, và cách xử lý",
      },
      {
        id: "how",
        title: "Cách yêu cầu hoàn tiền",
        placeholder: "Kênh liên hệ, thông tin cần cung cấp, thời gian phản hồi",
      },
      {
        id: "processing",
        title: "Hoàn tiền được chi trả thế nào",
        placeholder: "Phương thức và thời gian, số ngày VIP sẽ ra sao",
      },
    ],
  },
};

const CONTENT: Record<Locale, Record<LegalKey, LegalDoc>> = { en, vi };

export const getLegalDoc = (locale: Locale, key: LegalKey): LegalDoc => CONTENT[locale][key];
