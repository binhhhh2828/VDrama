import { LegalPage } from "@/components/legal/LegalPage";
import { getServerT } from "@/lib/i18n/server";
import { getLegalDoc } from "@/lib/legal-content";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">) {
  const { locale } = getServerT((await params).lang);
  return { title: getLegalDoc(locale, "privacy").title };
}

export default function PrivacyPage() {
  return <LegalPage docKey="privacy" />;
}
