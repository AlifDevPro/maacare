"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateUserLanguage, useUser } from "@/lib/auth-client";
import { writeGuestLanguage } from "@/lib/i18n/guest-language";
import { cn } from "@/lib/utils";

type GlobalLanguageSwitcherProps = {
  className?: string;
  /** Menu alignment for the dropdown panel */
  align?: "start" | "end" | "center";
};

export function GlobalLanguageSwitcher({ className, align = "end" }: GlobalLanguageSwitcherProps) {
  const { t, i18n } = useTranslation("shell");
  const user = useUser();
  const value = i18n.language?.startsWith("bn") ? "bn" : "en";

  async function setLang(next: "en" | "bn") {
    if (user) {
      const ok = await updateUserLanguage(next);
      if (!ok) toast.error(t("toast_language_error"));
    } else {
      writeGuestLanguage(next);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 shrink-0 gap-1.5 rounded-full px-3", className)}
          aria-label={t("language_switcher_aria")}
        >
          <Languages className="h-4 w-4 shrink-0" />
          <span className="text-xs font-semibold tabular-nums">{value.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="min-w-[min(100vw-2rem,12rem)] max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => void setLang(v as "en" | "bn")}>
          <DropdownMenuRadioItem value="en" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
            {t("language_english")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bn" className="cursor-pointer py-2.5 pl-8 pr-3 text-base">
            {t("language_bangla")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
