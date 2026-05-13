"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/app/AuthShell";
import { AiSignupChat } from "@/components/signup/ai-signup-chat";
import { SignupModeToggle, type SignupMode } from "@/components/signup/signup-mode-toggle";

import { ManualSignupWizard } from "./manual-signup-wizard";
import { useTranslation } from "react-i18next";

export function SignupPageClient() {
  const { t } = useTranslation("auth");
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
      title={t("signup_title")}
      subtitle={
        isAi ? t("signup_subtitle_ai") : t("signup_subtitle_manual")
      }
      footer={
        <>
          {t("signup_footer_have")}{" "}
          <Link href="/login" className="font-medium text-primary">
            {t("signup_footer_login")}
          </Link>
        </>
      }
    >
      <SignupModeToggle mode={mode} onChange={setMode} />
      {isAi ? <AiSignupChat /> : <ManualSignupWizard />}
    </AuthShell>
  );
}
