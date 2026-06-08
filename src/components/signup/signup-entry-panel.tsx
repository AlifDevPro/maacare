"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User } from "lucide-react";

import {
  AuthInlineAlert,
} from "@/components/auth/auth-inline-feedback";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkEmailRegistered } from "@/lib/auth-client";
import { FORM_FOCUS_SAFE } from "@/lib/form-control-focus";
import { validateAccountCredentials, validateTermsAccepted } from "@/lib/signup/validators";
import { isValidEmailFormat } from "@/lib/validation/email";
import { cn } from "@/lib/utils";

const fieldBase =
  "rounded-md border border-input bg-background shadow-none focus-visible:ring-1 h-11 w-full min-w-0 px-3";

export const SIGNUP_ENTRY_FORM_ID = "signup-entry-form";

export type SignupEntryWizardCredentials = {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

type SignupEntryPanelProps = {
  onGoogle: () => void;
  onTryAi: () => void;
  onContinueToWizard: (credentials: SignupEntryWizardCredentials) => void;
  googleLabel: string;
  aiLabel: string;
  aiBadge?: string;
  formHeading: string;
  formHelper: string;
  continueLabel: string;
  fullNameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordHint: string;
  termsLabel: string;
  emailCheckingLabel: string;
  emailTakenLabel: string;
  emailInvalidLabel: string;
  loginLabel: string;
  googleLoading?: boolean;
  externalError?: string | null;
};

export function SignupEntryPanel({
  onGoogle,
  onTryAi,
  onContinueToWizard,
  googleLabel,
  aiLabel,
  aiBadge,
  formHeading,
  formHelper,
  continueLabel,
  fullNameLabel,
  namePlaceholder,
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordHint,
  termsLabel,
  emailCheckingLabel,
  emailTakenLabel,
  emailInvalidLabel,
  loginLabel,
  googleLoading,
  externalError,
}: SignupEntryPanelProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [emailRegistered, setEmailRegistered] = useState<boolean | null>(null);
  const [emailLookupPending, setEmailLookupPending] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed)) {
      queueMicrotask(() => {
        setEmailRegistered(null);
        setEmailLookupPending(false);
      });
      return;
    }
    queueMicrotask(() => {
      setEmailLookupPending(true);
      setEmailRegistered(null);
    });
    const id = setTimeout(() => {
      void checkEmailRegistered(trimmed).then((r) => {
        if (cancelled) return;
        setEmailLookupPending(false);
        if (r.ok && "unavailable" in r && r.unavailable) {
          setEmailRegistered(null);
        } else if (r.ok && "registered" in r) {
          setEmailRegistered(r.registered);
        } else {
          setEmailRegistered(null);
        }
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const accErr = validateAccountCredentials({ name, email, password });
    if (accErr) {
      setFormError(accErr);
      return;
    }
    const termsErr = validateTermsAccepted(terms);
    if (termsErr) {
      setFormError(termsErr);
      return;
    }

    const dupCheck = await checkEmailRegistered(email.trim());
    if (dupCheck.ok && !("unavailable" in dupCheck) && dupCheck.registered) {
      setFormError(emailTakenLabel);
      setEmailRegistered(true);
      return;
    }

    setSubmitting(true);
    try {
      onContinueToWizard({
        name: name.trim(),
        email: email.trim(),
        password,
        termsAccepted: terms,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = formError ?? externalError ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
        <GoogleSignInButton
          label={googleLabel}
          onClick={onGoogle}
          loading={googleLoading}
        />

        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-11 w-full rounded-full border border-dashed border-border/70 bg-muted/15 text-sm font-semibold text-foreground",
            "hover:border-primary/35 hover:bg-primary-soft/25 hover:text-foreground",
          )}
          onClick={onTryAi}
        >
          <Sparkles className="mr-2 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{aiLabel}</span>
          {aiBadge ? (
            <span className="ml-1.5 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {aiBadge}
            </span>
          ) : null}
        </Button>
      </div>

      <div className="border-t border-border/60 pt-5">
        {displayError ? <AuthInlineAlert message={displayError} className="mb-4" /> : null}

        <form
          id={SIGNUP_ENTRY_FORM_ID}
          onSubmit={(e) => void handleSubmit(e)}
          className={cn("space-y-3.5", FORM_FOCUS_SAFE)}
        >
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{formHeading}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{formHelper}</p>
          </div>

          <div>
            <Label htmlFor="entry-name">{fullNameLabel}</Label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entry-name"
                autoComplete="name"
                placeholder={namePlaceholder}
                className={`${fieldBase} pl-9 placeholder:text-muted-foreground`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="entry-email">{emailLabel}</Label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entry-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={emailPlaceholder}
                className={`${fieldBase} pl-9 placeholder:text-muted-foreground`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailTouched(false);
                  setFormError(null);
                  setEmailRegistered(null);
                }}
                onBlur={() => {
                  setEmail((prev) => prev.trim());
                  setEmailTouched(true);
                }}
              />
            </div>
            {emailLookupPending && isValidEmailFormat(email.trim()) ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{emailCheckingLabel}</p>
            ) : null}
            {emailRegistered === true ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                {emailTakenLabel}{" "}
                <Link href="/login" className="underline underline-offset-2">
                  {loginLabel}
                </Link>
              </p>
            ) : null}
            {emailTouched && email.trim() && !isValidEmailFormat(email.trim()) ? (
              <p className="mt-1.5 text-xs text-destructive">{emailInvalidLabel}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="entry-password">{passwordLabel}</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entry-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={passwordHint}
                className={`${fieldBase} pl-9 pr-10 placeholder:text-muted-foreground`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError(null);
                }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={terms}
              onCheckedChange={(v) => {
                setTerms(!!v);
                setFormError(null);
              }}
              className="mt-0.5 rounded-sm"
            />
            <span className="text-muted-foreground">{termsLabel}</span>
          </label>

          <Button
            type="submit"
            className="h-11 w-full rounded-full text-sm font-semibold"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {continueLabel}
              </>
            ) : (
              continueLabel
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
