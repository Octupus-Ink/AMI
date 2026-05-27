import { AppShell } from "@/components/layout/AppShell";
import { MarketContextClient } from "@/components/market-context/MarketContextClient";

export default function MarketContextSetupPage() {
  return (
    <AppShell>
      <MarketContextClient />
    </AppShell>
  );
}
