"use client";

import Link from "next/link";
import { Crown, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PREMIUM_PRICE_BDT } from "@/lib/subscription/constants";
import type { SubscriptionFeature } from "@/lib/subscription/types";

const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  report_simplification: "report simplification",
  symptom_analysis: "symptom analysis",
  doctor_messaging: "direct doctor messaging",
  nearby_facilities: "nearby hospital and clinic connections",
};

type PaywallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: SubscriptionFeature | null;
  upgrading?: boolean;
  onUpgrade: () => void | Promise<unknown>;
};

export function PaywallModal({ open, onOpenChange, feature, upgrading, onUpgrade }: PaywallModalProps) {
  const featureLabel = feature ? FEATURE_LABELS[feature] : "this feature";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Crown className="h-5 w-5 text-amber-500" />
            Unlock Premium
          </DialogTitle>
          <DialogDescription>
            Unlock this by buying a subscription.
            {feature ? ` Premium includes unlimited ${featureLabel}.` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold">Premium — ৳{PREMIUM_PRICE_BDT.toLocaleString()} / month</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>Unlimited report simplification</li>
            <li>Unlimited symptom analysis</li>
            <li>Direct messaging with doctors</li>
            <li>Nearby hospital and clinic connections</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Button className="rounded-xl" disabled={upgrading} onClick={() => void onUpgrade()}>
            {upgrading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Premium
              </>
            )}
          </Button>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link href="/subscription">Compare plans</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
