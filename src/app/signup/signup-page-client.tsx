"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { AiSignupChat } from "@/components/signup/ai-signup-chat";
import { SignupFlowShell } from "@/components/signup/signup-flow-shell";
import { SignupMorphContent } from "@/components/signup/signup-morph-content";
import { SignupPathPicker } from "@/components/signup/signup-path-picker";
import type { SignupMode } from "@/components/signup/signup-mode-toggle";
import type { SignupWizardNav } from "@/components/signup/signup-wizard-nav";

import { ManualSignupWizard, MANUAL_SIGNUP_FORM_ID } from "./manual-signup-wizard";

type SignupPhase = "choose" | SignupMode;

/** Wizard steps need a bit more width on md+; persona cards stay single-column inside. */
const SIGNUP_WIZARD_CARD_CLASS = "md:max-w-lg lg:max-w-xl";

export function SignupPageClient() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<SignupPhase>("choose");
  const [wizardNav, setWizardNav] = useState<SignupWizardNav | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "ai" || q === "manual") {
      queueMicrotask(() => setPhase(q));
    }
  }, [searchParams]);

  const footer = registrationComplete ? (
    <Link href="/login" className="font-medium text-primary">
      {t("signup_footer_login")} →
    </Link>
  ) : (
    <>
      {t("signup_footer_have")}{" "}
      <Link href="/login" className="font-medium text-primary">
        {t("signup_footer_login")}
      </Link>
    </>
  );

  const goToChooser = useCallback(() => {
    setPhase("choose");
    setWizardNav(null);
    setRegistrationComplete(false);
  }, []);

  const handleBack = useCallback(() => {
    if (phase === "choose") {
      router.push("/login");
      return;
    }
    if (wizardNav && !wizardNav.isFirstStep) {
      wizardNav.onBackStep();
      return;
    }
    goToChooser();
  }, [goToChooser, phase, router, wizardNav]);

  const shellMeta = useMemo(() => {
    switch (phase) {
      case "choose":
        return {
          title: t("signup_title"),
          subtitle: t("signup_choose_subtitle"),
          bottom: null,
          skip: undefined,
          cardClassName: "sm:max-w-xl",
          compactTitle: false,
        };
      case "manual":
        return {
          title: t("signup_title"),
          subtitle: undefined,
          compactTitle: true,
          bottom: wizardNav
            ? {
                label: wizardNav.primaryLabel,
                onClick: wizardNav.onPrimary,
                disabled: wizardNav.primaryDisabled,
                isSubmit: wizardNav.isSubmit,
                formId: wizardNav.formId ?? MANUAL_SIGNUP_FORM_ID,
              }
            : null,
          skip:
            wizardNav?.showSkip && wizardNav.onSkip
              ? {
                  label: t("signup_wizard_skip"),
                  onClick: wizardNav.onSkip,
                  disabled: wizardNav.primaryDisabled,
                }
              : undefined,
          cardClassName: SIGNUP_WIZARD_CARD_CLASS,
        };
      case "ai":
        return {
          title: t("signup_path_ai_title"),
          subtitle: t("signup_subtitle_ai_short"),
          compactTitle: true,
          bottom: wizardNav
            ? {
                label: wizardNav.primaryLabel,
                disabled: wizardNav.primaryDisabled,
                isSubmit: wizardNav.isSubmit,
                formId: wizardNav.formId,
              }
            : null,
          skip: undefined,
          cardClassName: SIGNUP_WIZARD_CARD_CLASS,
        };
    }
  }, [phase, t, wizardNav]);

  const morphKey =
    phase === "choose"
      ? "choose"
      : phase === "manual"
        ? `manual-${wizardNav?.stepId ?? "loading"}`
        : "ai-signup";

  return (
    <SignupFlowShell
      title={shellMeta.title}
      subtitle={shellMeta.subtitle}
      footer={footer}
      onBack={handleBack}
      backLabel={t("auth_back")}
      bottomAction={shellMeta.bottom}
      skipAction={shellMeta.skip}
      cardClassName={shellMeta.cardClassName}
      compactTitle={shellMeta.compactTitle}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          className="min-w-0 w-full"
          layout
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
        >
          {phase === "choose" ? (
            <SignupPathPicker
              onPick={(mode) => {
                setRegistrationComplete(false);
                setPhase(mode);
              }}
              manualTitle={t("signup_path_manual_title")}
              manualDesc={t("signup_path_manual_desc")}
              aiTitle={t("signup_path_ai_title")}
              aiDesc={t("signup_path_ai_desc")}
              aiBadge={t("signup_path_ai_badge")}
            />
          ) : phase === "manual" ? (
            <ManualSignupWizard
              onNavChange={setWizardNav}
              onCompleteChange={setRegistrationComplete}
            />
          ) : (
            <SignupMorphContent contentKey={morphKey}>
              <AiSignupChat
                onNavChange={setWizardNav}
                onCompleteChange={setRegistrationComplete}
              />
            </SignupMorphContent>
          )}
        </motion.div>
      </AnimatePresence>
    </SignupFlowShell>
  );
}
