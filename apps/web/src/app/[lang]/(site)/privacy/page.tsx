import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Draft, not yet in effect"
      intro={
        <p>
          This policy explains what personal data VDrama collects, why, how long we keep it, and the
          choices you have.
        </p>
      }
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <>
              <p>
                Today the service stores: your email and display name, your watch progress and
                history, the series in My List, VIP plan dates, and basic technical data (IP
                address, browser) for security.
              </p>
              <Placeholder>
                Final wording, plus payment data handled by our payment provider
              </Placeholder>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <Placeholder>
              Running your account, remembering progress, VIP access, security and fraud prevention,
              service analytics
            </Placeholder>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <>
              <p>
                When you remove an item from your history or My List, it is hidden from you straight
                away but kept in our records for service analytics.
              </p>
              <Placeholder>
                Retention periods, and how full deletion or anonymisation works when you close your
                account
              </Placeholder>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Who we share it with",
          body: (
            <Placeholder>Service providers: hosting, video delivery, payments, email</Placeholder>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <Placeholder>
              Access, correction, deletion, objection, and how to make a request
            </Placeholder>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              We use only the cookies needed to keep you signed in securely. We do not use
              advertising cookies.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: <Placeholder>Data protection contact and the legal entity responsible</Placeholder>,
        },
      ]}
    />
  );
}
