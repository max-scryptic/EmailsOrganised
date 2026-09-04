import { WorkflowsPage } from "@/components/workflows/workflows-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <WorkflowsPage />;
}
