import type { Metadata } from "next";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { AdminHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New series" };
export const instant = false;

export default function NewSeriesPage() {
  return (
    <>
      <AdminHeader
        title="New series"
        text="Create the series first, then add episodes and upload their videos."
        back={{ href: "/admin/series", label: "All series" }}
      />
      <SeriesForm />
    </>
  );
}
