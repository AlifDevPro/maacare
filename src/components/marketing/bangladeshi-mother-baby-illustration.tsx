import { cn } from "@/lib/utils";

const STROKE = 1.85;

type Props = {
  title: string;
  className?: string;
};

/** Line-art: Bangladeshi mother in saree (bun), cradling baby, gaze toward infant. */
export function BangladeshiMotherBabyIllustration({ title, className }: Props) {
  const titleId = "maacare-hero-mother-baby-title";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 260"
      fill="none"
      role="img"
      aria-labelledby={titleId}
      className={cn("h-auto w-full text-primary/90", className)}
    >
      <title id={titleId}>{title}</title>
      <g
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Hair bun */}
        <circle cx="118" cy="52" r="11" />
        <path d="M108 48 Q102 42 98 36" />
        <path d="M122 44 Q128 38 132 32" />

        {/* Head profile, tilted toward baby */}
        <path d="M95 58 Q88 68 86 82 Q84 96 90 108" />
        <path d="M95 58 Q102 62 108 72" />

        {/* Gaze toward baby */}
        <path d="M92 78 Q78 88 62 98" strokeWidth={1.4} opacity={0.65} />

        {/* Neck + shoulder */}
        <path d="M98 108 L102 118" />
        <path d="M102 118 Q118 112 132 108" />

        {/* Saree pallu over shoulder */}
        <path d="M132 108 Q148 100 158 88 Q162 78 158 68" />
        <path d="M158 68 Q152 82 142 96 Q128 118 118 138" />

        {/* Bodice / blouse line */}
        <path d="M102 118 Q108 128 110 142" />
        <path d="M110 142 Q100 150 88 158" />

        {/* Saree pleats (skirt) */}
        <path d="M88 158 L72 228" />
        <path d="M100 162 L92 232" />
        <path d="M112 164 L108 234" />
        <path d="M124 160 L132 230" />
        <path d="M138 152 L152 220" />
        <path d="M72 228 Q100 238 132 230 Q152 224 158 210" />

        {/* Arm cradling baby */}
        <path d="M110 142 Q95 152 78 162 Q62 172 52 182" />
        <path d="M118 148 Q108 168 98 188" />

        {/* Baby wrapped / swaddled */}
        <ellipse cx="58" cy="192" rx="28" ry="22" />
        <path d="M42 188 Q48 178 58 176 Q68 174 74 182" />
        <circle cx="52" cy="186" r="2.5" fill="currentColor" stroke="none" />
        <path d="M48 190 Q54 194 60 192" strokeWidth={1.4} />

        {/* Second arm supporting baby */}
        <path d="M102 142 Q88 158 72 178" />

        {/* Bindi / simple cultural detail (optional dot) */}
        <circle cx="90" cy="74" r="1.5" fill="currentColor" stroke="none" opacity={0.5} />

        {/* Bangles on wrist */}
        <path d="M76 168 Q74 172 72 176" strokeWidth={1.2} />
        <path d="M78 170 Q76 174 74 178" strokeWidth={1.2} />
      </g>
    </svg>
  );
}
