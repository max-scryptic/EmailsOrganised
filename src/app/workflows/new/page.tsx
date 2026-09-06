import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { NewWorkflowFlow } from "@/components/workflows/new-workflow-flow";
import { isWorkflowChatConfigured } from "@/lib/ai/draft-workflow";

export const metadata: Metadata = { title: "New workflow" };

export default function NewWorkflowPage() {
  return (
    <AppShell
      title="New workflow"
      description="Describe what you want done with your email, then open what that builds on the board."
      breadcrumbs={[
        { title: "Workflows", href: "/workflows" },
        { title: "New workflow" },
      ]}
      // The chat and the builder each own their heading — the chat so it can
      // explain itself, the builder so the name stays editable — and both fill
      // everything under it.
      hideHeading
      fill
    >
      <NewWorkflowFlow chatConfigured={isWorkflowChatConfigured} />
    </AppShell>
  );
}
