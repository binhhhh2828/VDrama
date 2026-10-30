import { Poppins } from "next/font/google";

// Poppins không phải font biến nên phải liệt kê độ đậm.
export const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});
