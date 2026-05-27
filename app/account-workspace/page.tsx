import { AppShell } from "@/components/layout/AppShell";
import { AccountWorkspaceClient } from "@/components/workspace/AccountWorkspaceClient";

export default function AccountWorkspacePage() {
  return (
    <AppShell>
      <AccountWorkspaceClient />
    </AppShell>
  );
}
