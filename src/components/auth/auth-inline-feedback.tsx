"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared min-height so auth card content does not jump between phases. */
export const AUTH_CARD_PANEL_MIN_H = "min-h-[280px]";

type BackProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

/** Small back control for in-card auth steps (OTP, mail sent, etc.). */
export function AuthCardBackButton({ onClick, label = "Back", className }: BackProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "-ml-1 mb-3 flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

type AlertProps = {
  message: string;
  className?: string;
};

export function AuthInlineAlert({ message, className }: AlertProps) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </motion.div>
  );
}

type MailSendingProps = {
  label: string;
  className?: string;
  onBack?: () => void;
  backLabel?: string;
};

/** In-card loading while an email / code is being sent. */
export function AuthMailSendingState({
  label,
  className,
  onBack,
  backLabel,
}: MailSendingProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn("flex flex-col", AUTH_CARD_PANEL_MIN_H, className)}
      role="status"
      aria-live="polite"
      aria-busy
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {onBack ? (
        <AuthCardBackButton onClick={onBack} label={backLabel} className="self-start" />
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <motion.div
          animate={reduced ? {} : { y: [0, -4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"
        >
          <Mail className="h-8 w-8 text-primary" aria-hidden />
          <Loader2
            className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary"
            aria-hidden
          />
        </motion.div>
        <p className="text-center text-sm font-medium text-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

type MailSuccessProps = {
  title: string;
  body: string;
  email?: string;
  className?: string;
  children?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
};

/** Success state after email sent — mail + check icons, then optional revealed content (OTP). */
export function AuthMailSuccessState({
  title,
  body,
  email,
  className,
  children,
  onBack,
  backLabel,
}: MailSuccessProps) {
  return (
    <motion.div className={cn("flex w-full flex-col py-2", AUTH_CARD_PANEL_MIN_H, className)}>
      {onBack ? (
        <AuthCardBackButton onClick={onBack} label={backLabel} className="self-start" />
      ) : null}
      <motion.div className="flex flex-col items-center gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className="relative flex h-16 w-16 items-center justify-center"
        aria-hidden
      >
        <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/8">
          <Mail className="h-8 w-8 text-primary" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 18 }}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-1 text-center"
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        {email ? (
          <p className="text-sm font-medium text-foreground">{email}</p>
        ) : null}
      </motion.div>

      {children ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ delay: 0.35, duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="w-full overflow-hidden pt-2"
        >
          {children}
        </motion.div>
      ) : null}
      </motion.div>
    </motion.div>
  );
}

type SubmittingProps = {
  label: string;
  className?: string;
};

export function AuthSubmittingState({ label, className }: SubmittingProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10",
        AUTH_CARD_PANEL_MIN_H,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
      <p className="text-center text-sm font-medium text-foreground">{label}</p>
    </motion.div>
  );
}
