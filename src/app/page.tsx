import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { appConfig } from "@/lib/template-data";
import { savedWorkflows } from "@/lib/workflow-data";

export default function Home() {
  return (
    <AppShell
      title="Workflows"
      description={`The mailbox routines ${appConfig.name} runs for you. Open one to change how it classifies, routes, drafts, and reviews.`}
      actions={
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="size-4" />
            New workflow
          </Link>
        </Button>
      }
    >
      <WorkflowList workflows={savedWorkflows} />
    </AppShell>
  );
}
