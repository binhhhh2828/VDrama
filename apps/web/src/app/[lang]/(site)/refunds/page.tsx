import type { Metadata } from "next";
import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="Draft, not yet in effect"
      intro={
        <p>This policy explains when you can get your money back for a VIP plan and how to ask.</p>
      }
      sections={[
        {
          id: "eligibility",
          title: "When refunds are possible",
          body: (
            <Placeholder>
              Eligible cases, e.g. charged twice, paid but VIP not activated, time limits
            </Placeholder>
          ),
        },
        {
          id: "wrong-transfer",
          title: "Wrong or partial transfers",
          body: (
            <Placeholder>
              Transfers with the wrong note, too little or too much money, and how they are handled
            </Placeholder>
          ),
        },
        {
          id: "how",
          title: "How to request a refund",
          body: <Placeholder>Contact channel, information to include, response time</Placeholder>,
        },
        {
          id: "processing",
          title: "How refunds are paid",
          body: <Placeholder>Method and timing, what happens to the VIP days</Placeholder>,
        },
      ]}
    />
  );
}
