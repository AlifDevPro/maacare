import { Suspense } from "react";

import { SignupPageClient } from "./signup-page-client";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <SignupPageClient />
    </Suspense>
  );
}
