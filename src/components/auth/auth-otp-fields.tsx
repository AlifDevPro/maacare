"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/** Supabase email OTP length (project configured for 8 digits). */
export const AUTH_OTP_LENGTH = 8;

export function isValidEmailOtpToken(raw: string): boolean {
  return /^\d{8}$/.test(raw.replace(/\D/g, ""));
}

export function normalizeEmailOtp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH);
}

type Props = {
  code: string;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  verifying: boolean;
  verifyLabel: string;
  hint: string;
  disabled?: boolean;
};

export function AuthOtpFields({
  code,
  onCodeChange,
  onVerify,
  verifying,
  verifyLabel,
  hint,
  disabled,
}: Props) {
  const submittedRef = useRef(false);

  const handleChange = useCallback(
    (value: string) => {
      submittedRef.current = false;
      onCodeChange(value.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH));
    },
    [onCodeChange],
  );

  const handleComplete = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, "");
      if (digits.length !== AUTH_OTP_LENGTH || verifying || disabled) return;
      if (submittedRef.current) return;
      submittedRef.current = true;
      onVerify();
    },
    [disabled, onVerify, verifying],
  );

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.35 }}
    >
      <div className="flex flex-col items-center gap-2">
        <InputOTP
          maxLength={AUTH_OTP_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          pasteTransformer={(pasted) => pasted.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH)}
          value={code}
          onChange={handleChange}
          onComplete={handleComplete}
          disabled={disabled || verifying}
        >
          <InputOTPGroup>
            {Array.from({ length: AUTH_OTP_LENGTH }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p className="text-center text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button
        type="button"
        className="w-full rounded-full"
        disabled={disabled || verifying || !isValidEmailOtpToken(code)}
        onClick={onVerify}
      >
        {verifying ? "…" : verifyLabel}
      </Button>
    </motion.div>
  );
}
