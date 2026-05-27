import { AppShell } from "@/components/layout/AppShell";
import { RecommendationsClient } from "@/components/recommendations/RecommendationsClient";

export default function RecommendationsPage() {
  return (
    <AppShell>
      <RecommendationsClient />
    </AppShell>
  );
}
