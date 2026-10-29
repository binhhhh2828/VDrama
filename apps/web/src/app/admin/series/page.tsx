import type { Metadata } from "next";
import { SeriesTable } from "@/components/admin/SeriesTable";

export const metadata: Metadata = { title: "Series" };
export const instant = false;

export default function AdminSeriesPage() {
  return <SeriesTable />;
}
