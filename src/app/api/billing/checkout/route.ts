import { z } from "zod";
import { billingErrorResponse } from "@/app/api/billing/errors";
import { changePlan } from "@/lib/billing/stripe/service";
import { plans } from "@/lib/template-data";

/**
 * Starts a plan change.
 *
 * Returns either a Checkout URL to redirect to (customer has no subscription
 * yet) or an `applied` result (existing subscription swapped in place). The
 * client never decides which — it follows whatever comes back.
 */

const requestSchema = z.object({ planId: z.string() });

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    const plan = parsed.success
      ? plans.find((candidate) => candidate.id === parsed.data.planId)
      : undefined;

    if (!plan) {
      return Response.json({ error: "Unknown plan." }, { status: 400 });
    }

    // Sales-led plans have no self-serve price, so there is nothing to buy.
    if (plan.contactSales) {
      return Response.json(
        { error: `${plan.name} is sold through sales, not checkout.` },
        { status: 400 },
      );
    }

    return Response.json(await changePlan({ planId: plan.id }));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
