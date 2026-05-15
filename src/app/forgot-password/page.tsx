"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/app/AuthShell";
import {
  AUTH_CARD_PANEL_MIN_H,
  AuthInlineAlert,
  AuthMailSendingState,
  AuthMailSuccessState,
} from "@/components/auth/auth-inline-feedback";
import {
  AuthOtpFields,
  isValidEmailOtpToken,
  normalizeEmailOtp,
} from "@/components/auth/auth-otp-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, verifyLoginEmailOtp } from "@/lib/auth-client";
import { isValidEmailFormat } from "@/lib/validation/email";

type Phase = "form" | "sending" | "sent";

export default function ForgotPage() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const canSend = useMemo(() => isValidEmailFormat(email), [email]);
  const busy = phase === "sending" || verifying;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError(t("auth_error_enter_email"));
      return;
    }
    if (!isValidEmailFormat(email)) {
      setFormError(t("auth_error_valid_email"));
      return;
    }

    setPhase("sending");
    try {
      const result = await requestPasswordReset(email.trim());
      if (!result.ok) {
        setFormError(result.error);
        setPhase("form");
        return;
      }
      setPhase("sent");
    } catch {
      setFormError(t("auth_error_valid_email"));
      setPhase("form");
    }
  };

  const verifyCode = async () => {
    setVerifyError(null);
    if (!isValidEmailOtpToken(code)) return;

    setVerifying(true);
    try {
      const result = await verifyLoginEmailOtp(email.trim(), normalizeEmailOtp(code), {
        flow: "password-reset",
      });
      if (!result.ok) {
        setVerifyError(result.error);
        return;
      }
      router.replace("/reset-password");
    } catch {
      setVerifyError(t("auth_error_valid_email"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthShell
      title={t("forgot_title")}
      subtitle={phase === "sent" ? undefined : t("forgot_subtitle")}
      footer={
        busy || phase === "sent" ? null : (
          <Link href="/login" className="font-medium text-primary">
            {t("signup_footer_login")}
          </Link>
        )
      }
    >
      <motion.div layout className={AUTH_CARD_PANEL_MIN_H}>
        {phase === "sending" ? (
          <AuthMailSendingState
            label={t("auth_mail_sending")}
            onBack={() => setPhase("form")}
            backLabel={t("auth_back")}
          />
        ) : phase === "sent" ? (
          <AuthMailSuccessState
            title={t("auth_mail_success_title")}
            body={t("auth_mail_success_body")}
            email={email.trim()}
            onBack={() => {
              setPhase("form");
              setCode("");
              setVerifyError(null);
              setFormError(null);
            }}
            backLabel={t("auth_back")}
          >
            {verifyError ? <AuthInlineAlert message={verifyError} className="mb-2" /> : null}
            <AuthOtpFields
              code={code}
              onCodeChange={(value) => {
                setCode(value);
                setVerifyError(null);
              }}
              onVerify={() => void verifyCode()}
              verifying={verifying}
              verifyLabel={t("auth_verify_reset")}
              hint={t("auth_otp_hint")}
              disabled={verifying}
            />
          </AuthMailSuccessState>
        ) : (
          <form onSubmit={(e) => void sendCode(e)} className="space-y-4">
            {formError ? <AuthInlineAlert message={formError} /> : null}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <motion.div>
                <Label htmlFor="email">{t("email")}</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="min-w-0 pl-9"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFormError(null);
                    }}
                  />
                </div>
                {email.trim() && !canSend ? (
                  <p className="mt-1.5 text-xs text-destructive">{t("auth_error_valid_email")}</p>
                ) : null}
              </motion.div>
              <Button className="w-full rounded-full" type="submit" disabled={!canSend}>
                {t("forgot_send_button")}
              </Button>
            </motion.div>
          </form>
        )}
      </motion.div>
    </AuthShell>
  );
}
