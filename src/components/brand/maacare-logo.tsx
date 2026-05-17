import Image from "next/image";
import Link from "next/link";

import { BRAND_ASSETS, SITE_NAME } from "@/lib/seo/site-config";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { px: 40, mark: "h-10 w-10", text: "text-base" },
  md: { px: 48, mark: "h-12 w-12", text: "text-lg" },
  lg: { px: 56, mark: "h-14 w-14", text: "text-xl" },
  xl: { px: 64, mark: "h-16 w-16", text: "text-2xl" },
} as const;

type MaaCareLogoProps = {
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
  href?: string;
  onClick?: () => void;
  priority?: boolean;
};

export function MaaCareLogo({
  size = "md",
  showWordmark = true,
  wordmarkClassName,
  className,
  href,
  onClick,
  priority,
}: MaaCareLogoProps) {
  const preset = SIZES[size];

  const content = (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src={BRAND_ASSETS.logoMark}
        alt=""
        width={preset.px}
        height={preset.px}
        priority={priority}
        className={cn("shrink-0 rounded-2xl object-contain shadow-soft", preset.mark)}
      />
      {showWordmark ? (
        <span
          className={cn(
            "truncate font-display font-semibold tracking-tight text-foreground",
            preset.text,
            wordmarkClassName,
          )}
        >
          {SITE_NAME}
        </span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex min-w-0 rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="inline-flex min-w-0 rounded-lg" onClick={onClick}>
        {content}
      </button>
    );
  }

  return content;
}
