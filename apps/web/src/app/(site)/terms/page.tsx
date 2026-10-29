import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="Draft, not yet in effect"
      intro={
        <p>
          These terms explain the rules for using VDrama, including accounts, VIP plans and the
          content you watch.
        </p>
      }
      sections={[
        {
          id: "accounts",
          title: "Your account",
          body: (
            <Placeholder>
              Who can create an account, keeping your password safe, one person per account, device
              limit
            </Placeholder>
          ),
        },
        {
          id: "content",
          title: "Watching content",
          body: (
            <Placeholder>
              Personal, non-commercial viewing only; no recording, re-uploading or sharing of
              episodes
            </Placeholder>
          ),
        },
        {
          id: "vip",
          title: "VIP plans and payments",
          body: (
            <Placeholder>
              Plan lengths, prices, no automatic renewal, how extensions stack, what happens when a
              plan ends
            </Placeholder>
          ),
        },
        {
          id: "conduct",
          title: "Acceptable use",
          body: (
            <Placeholder>
              Prohibited behaviour, account sharing, attempts to bypass access controls
            </Placeholder>
          ),
        },
        {
          id: "termination",
          title: "Suspension and closing accounts",
          body: (
            <Placeholder>When we may suspend an account and how you can close yours</Placeholder>
          ),
        },
        {
          id: "liability",
          title: "Liability and changes",
          body: (
            <Placeholder>
              Service availability, limitation of liability, how we announce changes to these terms
            </Placeholder>
          ),
        },
        {
          id: "law",
          title: "Governing law and contact",
          body: (
            <Placeholder>
              Governing law, the legal entity operating VDrama, contact details
            </Placeholder>
          ),
        },
      ]}
    />
  );
}
