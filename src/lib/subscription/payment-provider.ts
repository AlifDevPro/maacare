import type { SubscriptionView } from "@/lib/subscription/types";

export type PaymentProviderResult =
  | { ok: true; provider: string; reference: string }
  | { ok: false; message: string };

/**
 * Payment gateway abstraction. Replace `processPremiumCheckout` with a real
 * provider (bKash, SSLCommerz, Stripe, etc.) without changing feature gates.
 */
export async function processPremiumCheckout(input: {
  userId: string;
  amountBdt: number;
  paymentMethod?: string;
}): Promise<PaymentProviderResult> {
  const method = input.paymentMethod ?? "mock";

  if (method === "mock") {
    if (process.env.SUBSCRIPTION_MOCK_PAYMENTS === "0") {
      return { ok: false, message: "Payments are not enabled yet. Please try again later." };
    }
    return {
      ok: true,
      provider: "mock",
      reference: `mock_${input.userId}_${Date.now()}`,
    };
  }

  return { ok: false, message: "This payment method is not supported yet." };
}

export type ActivatePremiumResult = {
  subscription: SubscriptionView;
  payment: PaymentProviderResult & { ok: true };
};
