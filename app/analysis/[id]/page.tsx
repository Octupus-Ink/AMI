import { AnalysisDetailClient } from "@/components/agents/AnalysisDetailClient";
import { AppShell } from "@/components/layout/AppShell";

type AnalysisPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <AnalysisDetailClient id={id} />
    </AppShell>
  );
}
