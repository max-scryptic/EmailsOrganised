import { redirect } from "next/navigation";

/**
 * Workflows are the app surface, and the sidebar's only destination is
 * `/workflows`. "/" is where sign-in lands, so send it there rather than
 * keeping a second copy of the list.
 */
export default function Home() {
  redirect("/workflows");
}
