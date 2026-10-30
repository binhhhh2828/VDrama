import { LegalPage } from "@/components/legal/LegalPage";
import { getServerT } from "@/lib/i18n/server";
import { getLegalDoc } from "@/lib/legal-content";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">) {
  const { locale } = getServerT((await params).lang);
  return { title: getLegalDoc(locale, "terms").title };
}

export default function TermsPage() {
  return <LegalPage docKey="terms" />;
}
