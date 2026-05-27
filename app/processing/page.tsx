import { AppShell } from "@/components/layout/AppShell";
import { ProcessingClient } from "@/components/processing/ProcessingClient";

export default function ProcessingPage() {
  return (
    <AppShell>
      <ProcessingClient />
    </AppShell>
  );
}
