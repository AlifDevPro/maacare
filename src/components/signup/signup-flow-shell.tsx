"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";

import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

type BottomAction = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  isSubmit?: boolean;
  formId?: string;
};

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  bottomAction?: BottomAction | null;
  skipAction?: { label: string; onClick: () => void; disabled?: boolean };
  className?: string;
  cardClassName?: string;
  compactTitle?: boolean;
};

export function SignupFlowShell({
  title,
  subtitle,
  children,
  footer,
  onBack,
  backLabel = "Back",
  bottomAction,
  skipAction,
  className,
  cardClassName,
  compactTitle,
}: Props) {
  const leadingAction = onBack ? (
    <button
      type="button"
      onClick={onBack}
      aria-label={backLabel}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </button>
  ) : undefined;

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      footer={footer}
      leadingAction={leadingAction}
      cardClassName={cardClassName}
      compactTitle={compactTitle}
    >
      <div className={cn("flex min-w-0 flex-col", className)}>
        <div className="min-w-0 flex-1">{children}</div>
        {bottomAction ? (
          <div className="mt-6 space-y-2 border-t border-border/50 pt-4">
            {skipAction ? (
              <button
                type="button"
                onClick={skipAction.onClick}
                disabled={skipAction.disabled}
                className="w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {skipAction.label}
              </button>
            ) : null}
            <Button
              type={bottomAction.isSubmit ? "submit" : "button"}
              form={bottomAction.isSubmit ? bottomAction.formId : undefined}
              className="w-full rounded-full"
              disabled={bottomAction.disabled || bottomAction.loading}
              onClick={bottomAction.isSubmit ? undefined : bottomAction.onClick}
            >
              {bottomAction.loading ? "…" : bottomAction.label}
              {!bottomAction.loading && !bottomAction.isSubmit ? (
                <ChevronRight className="ml-1 h-4 w-4" />
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
