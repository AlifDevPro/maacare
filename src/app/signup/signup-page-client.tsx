"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/app/AuthShell";
import { AiSignupChat } from "@/components/signup/ai-signup-chat";
import { SignupModeToggle, type SignupMode } from "@/components/signup/signup-mode-toggle";

import { ManualSignupWizard } from "./manual-signup-wizard";

export function SignupPageClient() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SignupMode>("manual");

  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "ai") {
      queueMicrotask(() => setMode("ai"));
    }
  }, [searchParams]);

  const isAi = mode === "ai";

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        isAi
          ? "Answer a few questions in chat, then finish with your email and password on the secure step."
          : "Add your details in a few steps. Optional sections can be skipped and completed anytime in Profile."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary">
            Log in
          </Link>
        </>
      }
    >
      <SignupModeToggle mode={mode} onChange={setMode} />
      {isAi ? <AiSignupChat /> : <ManualSignupWizard />}
    </AuthShell>
  );
}
