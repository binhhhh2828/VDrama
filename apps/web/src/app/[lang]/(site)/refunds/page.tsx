import { LegalPage } from "@/components/legal/LegalPage";
import { getServerT } from "@/lib/i18n/server";
import { getLegalDoc } from "@/lib/legal-content";

export async function generateMetadata({ params }: PageProps<"/[lang]/refunds">) {
  const { locale } = getServerT((await params).lang);
  return { title: getLegalDoc(locale, "refunds").title };
}

export default function RefundsPage() {
  return <LegalPage docKey="refunds" />;
}
