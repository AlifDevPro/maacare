import { z } from "zod";

import { failJson, serverErrorJson, validationJsonResponse } from "@/lib/api/error-response";
import { getSessionFromCookies } from "@/lib/auth/get-session";
import { PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import { processPremiumCheckout } from "@/lib/subscription/payment-provider";
import { activatePremiumSubscription } from "@/lib/subscription/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  paymentMethod: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failJson(401, "Sign in to upgrade.");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return validationJsonResponse(parsed.error);

    const payment = await processPremiumCheckout({
      userId: session.id,
      amountBdt: PREMIUM_PRICE_BDT,
      paymentMethod: parsed.data.paymentMethod,
    });

    if (!payment.ok) {
      return failJson(402, payment.message, { error: "payment_failed" });
    }

    const supabase = await createSupabaseServerClient();
    const subscription = await activatePremiumSubscription(supabase, session.id);

    return Response.json({
      ok: true,
      subscription,
      payment: {
        provider: payment.provider,
        reference: payment.reference,
        amountBdt: PREMIUM_PRICE_BDT,
      },
    });
  } catch (e) {
    return serverErrorJson("subscription/upgrade POST", e);
  }
}
