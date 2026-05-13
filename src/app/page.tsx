"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import type { Swiper as SwiperClass } from "swiper";
import { Autoplay, EffectCoverflow } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/effect-coverflow";
import {
  Heart, Sparkles, Stethoscope, Phone, Users, Calendar, FileText,
  ChevronRight, Check, Star, ShieldCheck, Globe, Github, Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const features = [
  { icon: Sparkles, title: "AI Chat", desc: "Ask anything, anytime. Grounded in trusted medical knowledge.", tone: "rose" },
  { icon: Stethoscope, title: "Symptom & Risk Check", desc: "Quick triage with clear severity guidance.", tone: "sage" },
  { icon: Phone, title: "Emergency Map", desc: "Find the nearest hospital and one-tap hotlines.", tone: "rose" },
  { icon: Users, title: "Mother Community", desc: "Verified tips, real questions, supportive replies.", tone: "sage" },
  { icon: Calendar, title: "Week-by-Week Planner", desc: "Hydration, nutrition and milestones tailored to you.", tone: "rose" },
  { icon: FileText, title: "Report Simplifier", desc: "Upload medical reports and get plain-language summaries.", tone: "sage" },
] as const;

const steps = [
  { n: "01", title: "Create your account", desc: "Sign up in under a minute with your email." },
  { n: "02", title: "Tell us your week", desc: "Slide to your current pregnancy week (1–40)." },
  { n: "03", title: "Get personalized care", desc: "Daily plan, AI answers, and gentle reminders." },
];

const testimonials = [
  { name: "Nusrat A.", week: "Week 28", quote: "MaaCare feels like having a midwife in my pocket. The week-by-week guidance is so calming." },
  { name: "Sara K.", week: "Postpartum", quote: "Simplifying my reports made my appointments 10x less stressful." },
  { name: "Maya R.", week: "Week 14", quote: "The community here is gentle and informed. I've found answers I couldn't get anywhere else." },
];

const faqs = [
  { q: "Is MaaCare a replacement for my doctor?", a: "No. MaaCare offers educational support and AI guidance grounded in medical literature, but it does not replace professional consultation. Always consult a qualified clinician for diagnosis and treatment." },
  { q: "Is my data private?", a: "Yes. Your data is encrypted in transit and at rest. You stay in control and can delete your account at any time." },
  { q: "Does it work in low-bandwidth areas?", a: "MaaCare is built lightweight-first. Core features work on slow connections and small devices." },
  { q: "Is it really free?", a: "During beta, every feature is free. We will always keep an essential free tier." },
  { q: "Which languages are supported?", a: "English and বাংলা (Bangla) at launch, with more languages coming soon." },
  { q: "How accurate is the AI?", a: "Our AI is grounded in WHO and peer-reviewed sources via retrieval-augmented generation, with clear citations and conservative escalation rules." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
        <TeamSection />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-rose text-base shadow-soft">🤍</span>
          <span className="font-display text-xl font-semibold tracking-tight">MaaCare</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="text-sm font-medium text-muted-foreground hover:text-foreground">How it works</a>
          <a href="#team" className="text-sm font-medium text-muted-foreground hover:text-foreground">Team</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pricing</a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
          <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground">Docs</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="sm:hidden">
            <Link href="/docs">Docs</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-x-clip bg-gradient-hero">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:gap-10 sm:py-16 md:grid-cols-2 md:gap-10 md:py-28">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="order-1 flex min-h-0 flex-col justify-center"
        >
          <Badge variant="secondary" className="mb-5 w-fit gap-1.5 rounded-full bg-card/70 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> AI grounded in medical knowledge
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
            Calm, expert care<br />from week 1 to baby.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground md:text-lg">
            MaaCare is your AI maternal health companion — personalized week-by-week guidance, symptom triage, and a gentle community, all in one place.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-6">
              <Link href="/signup">Get started free <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
          <div className="mt-7 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> Privacy-first</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-accent" /> EN · বাংলা</span>
            <span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-primary" /> Free during beta</span>
          </div>
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="relative order-2 flex min-h-0 items-center justify-center"
        >
          <div className="absolute -left-6 top-8 hidden h-44 w-44 rounded-full bg-primary-soft blur-3xl md:block" />
          <div className="absolute -right-6 bottom-8 hidden h-52 w-52 rounded-full bg-accent-soft blur-3xl md:block" />
          <Card className="relative w-full max-w-sm overflow-hidden border-0 bg-card/80 p-6 shadow-card backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Pregnancy week</p>
                <p className="font-display text-5xl font-semibold leading-none">20<span className="text-lg text-muted-foreground">/40</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Trimester 2 · 20 weeks to go</p>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-5xl shadow-soft animate-float">🍌</div>
            </div>
            <div className="mt-5 rounded-2xl bg-accent-soft/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground/70">Today</p>
              <p className="mt-1 text-sm font-medium">Your baby is the size of a banana 🍌</p>
              <p className="mt-1 text-xs text-muted-foreground">About 25cm long and developing rapidly.</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { l: "Hydration", v: "4/8" },
                { l: "Sleep", v: "7h" },
                { l: "Steps", v: "3.4k" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-muted p-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.l}</p>
                  <p className="text-sm font-semibold">{s.v}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Features</p>
        <h2 className="mt-2 font-display text-3xl font-semibold leading-tight md:text-4xl">Everything you need, nothing you don't.</h2>
        <p className="mt-3 text-muted-foreground">Designed with mothers and clinicians for clarity, accuracy, and warmth.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="group p-6 transition-all hover:-translate-y-1 hover:shadow-card">
            <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${f.tone === "rose" ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent"}`}>
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-secondary/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Start in three calm steps.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.n} className="relative p-6">
              <span className="font-display text-5xl font-semibold text-primary/20">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              {i < steps.length - 1 && (
                <ChevronRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-muted-foreground/40 md:block" />
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Loved by mothers</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Trusted by thousands of expecting mothers.</h2>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div><span className="font-display text-2xl font-semibold text-foreground">12k+</span> mothers</div>
          <div><span className="font-display text-2xl font-semibold text-foreground">98%</span> recommend</div>
          <div className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" /><span className="font-semibold text-foreground">4.9</span></div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((t) => (
          <Card key={t.name} className="p-6">
            <div className="flex gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-primary" />)}
            </div>
            <p className="mt-3 text-sm leading-relaxed">"{t.quote}"</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {t.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.week}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

type LandingTeamMember = {
  userId: string;
  name: string;
  jobTitle: string;
  bio: string;
  imageUrl: string | null;
  social: {
    github: string | null;
    twitter: string | null;
    linkedin: string | null;
    website: string | null;
  };
  sortOrder: number;
};

/**
 * Swiper loop + centeredSlides + slidesPerView:auto needs enough slides vs visible
 * slots on wide screens, or the track locks / autoplay stops at the end.
 * Below this count we repeat the roster (same members, stable keys) only for the carousel.
 */
const TEAM_LOOP_MIN_SLIDES = 12;

function buildTeamCarouselSlides(members: LandingTeamMember[]): { member: LandingTeamMember; key: string }[] {
  const n = members.length;
  if (n < 2) return [];
  if (n >= TEAM_LOOP_MIN_SLIDES) {
    return members.map((m) => ({ member: m, key: m.userId }));
  }
  const total = Math.ceil(TEAM_LOOP_MIN_SLIDES / n) * n;
  return Array.from({ length: total }, (_, idx) => {
    const m = members[idx % n]!;
    return { member: m, key: `${m.userId}-${idx}` };
  });
}

/** Fixed portrait frame so every team card matches (1, 2, or many members). */
const TEAM_CARD_OUTER = "w-[280px] max-w-[min(280px,calc(100vw-2rem))]";

function TeamSpotCard({
  member: m,
  emphasis,
}: {
  member: LandingTeamMember;
  emphasis: "primary" | "secondary";
}) {
  const primary = emphasis === "primary";
  return (
    <div className={TEAM_CARD_OUTER}>
      <Card
        className={cn(
          "h-full overflow-hidden border-0 p-0 transition-shadow duration-500",
          primary ? "shadow-xl ring-1 ring-black/15 dark:ring-white/10" : "shadow-card ring-1 ring-black/10 dark:ring-white/5",
        )}
      >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {m.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-muted font-display text-4xl font-semibold text-primary/35 sm:text-5xl">
            {m.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 min-w-0 p-4 pt-14 sm:pt-16">
          <h3 className="font-display text-lg font-semibold leading-tight text-white drop-shadow-sm sm:text-xl">{m.name}</h3>
          <p className="mt-1 text-sm font-medium text-white/90">{m.jobTitle}</p>
          {m.bio ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75 sm:line-clamp-4">{m.bio}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.social.github ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-8 rounded-full border-0 bg-white/15 px-2.5 text-white backdrop-blur hover:bg-white/25"
              >
                <a href={m.social.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {m.social.linkedin ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-8 rounded-full border-0 bg-white/15 px-2.5 text-white backdrop-blur hover:bg-white/25"
              >
                <a href={m.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {m.social.twitter ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-8 rounded-full border-0 bg-white/15 px-2.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                <a href={m.social.twitter} target="_blank" rel="noopener noreferrer" aria-label="X">
                  X
                </a>
              </Button>
            ) : null}
            {m.social.website ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-8 rounded-full border-0 bg-white/15 px-2.5 text-white backdrop-blur hover:bg-white/25"
              >
                <a href={m.social.website} target="_blank" rel="noopener noreferrer" aria-label="Website">
                  <Globe className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      </Card>
    </div>
  );
}

/** Pause on each spotlight before advancing. */
const TEAM_ROTATE_MS = 6000;

function TeamSection() {
  const [members, setMembers] = useState<LandingTeamMember[] | null>(null);
  /** Physical slide index in the carousel (covers duplicated slides for seamless loop). */
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const swiperRef = useRef<SwiperClass | null>(null);

  const carouselSlides = useMemo(() => (members ? buildTeamCarouselSlides(members) : []), [members]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/team", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { members?: LandingTeamMember[] }) => {
        if (cancelled) return;
        setMembers(Array.isArray(j.members) ? j.members : []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (members === null) {
    return (
      <section id="team" className="border-t border-border/50 bg-secondary/20 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">Loading team…</div>
      </section>
    );
  }

  if (members.length === 0) return null;

  const n = members.length;

  const subtitle = "Meet the people building MaaCare.";

  const headerBlock = (
    <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">Team</p>
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight md:text-4xl">The people building MaaCare.</h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </div>
  );

  if (n === 1) {
    return (
      <section
        id="team"
        className="border-t border-border/50 bg-gradient-to-b from-secondary/25 via-secondary/15 to-background py-20 pb-24 md:py-28 md:pb-32"
      >
        <div className="mx-auto max-w-6xl px-4">
          {headerBlock}
          <motion.div
            className="flex justify-center"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <TeamSpotCard member={members[0]!} emphasis="primary" />
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="team"
      className="border-t border-border/50 bg-gradient-to-b from-secondary/25 via-secondary/15 to-background py-20 pb-24 md:py-28 md:pb-32"
    >
      <div className="mx-auto max-w-6xl px-4">
        {headerBlock}

        <div className="relative min-h-[420px] sm:min-h-[460px]">
          <Swiper
            key={members.map((m) => m.userId).join("|")}
            modules={[Autoplay, EffectCoverflow]}
            effect="coverflow"
            grabCursor
            centeredSlides
            slidesPerView="auto"
            loop={carouselSlides.length >= 2}
            loopAdditionalSlides={4}
            /* Prevents lock when all slides fit the row (default watchOverflow would stop autoplay). */
            watchOverflow={false}
            speed={prefersReducedMotion ? 300 : 700}
            spaceBetween={20}
            autoplay={
              prefersReducedMotion
                ? false
                : {
                    delay: TEAM_ROTATE_MS,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: false,
                    stopOnLastSlide: false,
                  }
            }
            coverflowEffect={{
              rotate: 0,
              stretch: 0,
              depth: 200,
              modifier: 1,
              slideShadows: false,
            }}
            onSwiper={(sw) => {
              swiperRef.current = sw;
              setActiveIndex(sw.activeIndex);
            }}
            onSlideChange={(sw) => setActiveIndex(sw.activeIndex)}
            className="team-swiper w-full pt-2 pb-2"
          >
            {carouselSlides.map((slide, idx) => (
              <SwiperSlide
                key={slide.key}
                className="!flex max-w-[min(280px,calc(100vw-2rem))] justify-center !py-6"
                style={{ width: 280 }}
              >
                <TeamSpotCard member={slide.member} emphasis={idx === activeIndex ? "primary" : "secondary"} />
              </SwiperSlide>
            ))}
          </Swiper>

          <div
            className="mx-auto mt-6 flex max-w-full flex-wrap items-center justify-center gap-2 px-2"
            role="tablist"
            aria-label="Team carousel slides"
          >
            {members.map((m, i) => {
              const centeredId = carouselSlides[activeIndex]?.member.userId;
              const active = centeredId === m.userId;
              return (
                <button
                  key={m.userId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Show ${m.name}`}
                  onClick={() => {
                    const sw = swiperRef.current;
                    if (!sw) return;
                    sw.slideToLoop(i);
                  }}
                  className={cn(
                    "h-2 shrink-0 rounded-full transition-all duration-500 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    active
                      ? "w-10 bg-primary shadow-sm ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                      : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/45",
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const perks = [
    "Unlimited AI chat",
    "Week-by-week planner",
    "Symptom & risk checker",
    "Emergency map & hotlines",
    "Verified community",
    "Report simplifier",
    "EN & বাংলা support",
  ];
  return (
    <section id="pricing" className="bg-gradient-hero py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <Badge variant="secondary" className="mb-4 rounded-full bg-card/70 px-3 py-1 backdrop-blur">Free during beta</Badge>
        <h2 className="font-display text-3xl font-semibold md:text-4xl">One simple plan. Free for every mother.</h2>
        <p className="mt-3 text-muted-foreground">No credit card. No hidden fees. We're dedicated to keeping essential maternal care accessible.</p>
        <Card className="mx-auto mt-10 max-w-md overflow-hidden border-0 p-8 text-left shadow-card">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Beta access</p>
              <p className="mt-1 font-display text-5xl font-semibold">Free</p>
            </div>
            <Badge className="bg-accent text-accent-foreground">Limited time</Badge>
          </div>
          <ul className="mt-6 space-y-2.5">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-7 w-full rounded-full">
            <Link href="/signup">Claim free access</Link>
          </Button>
        </Card>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:py-28">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">FAQ</p>
        <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Questions, answered gently.</h2>
      </div>
      <Accordion type="single" collapsible className="rounded-2xl border bg-card p-2 shadow-soft">
        {faqs.map((f, i) => (
          <AccordionItem key={f.q} value={`item-${i}`} className="border-b last:border-0">
            <AccordionTrigger className="px-3 text-left text-sm font-medium hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="px-3 text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-20">
      <Card className="overflow-hidden border-0 bg-gradient-rose p-10 text-center shadow-card">
        <h2 className="font-display text-3xl font-semibold text-balance md:text-4xl">Begin your gentle journey today.</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">Join thousands of mothers using MaaCare for calmer, more confident pregnancy care.</p>
        <Button asChild size="lg" className="mt-6 rounded-full">
          <Link href="/signup">Create my free account <ChevronRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </Card>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-rose">🤍</span>
            <span className="font-display text-lg font-semibold">MaaCare</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">AI maternal health companion. Calm, accurate, accessible.</p>
          <Link
            href="/docs"
            className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Documentation
          </Link>
        </div>
        <FooterCol title="Product" items={["Features", "How it works", "Pricing", "FAQ"]} />
        <FooterCol title="Company" items={["About", "Blog", "Careers", "Contact"]} />
        <FooterCol title="Legal" items={["Privacy", "Terms", "Security", "Cookies"]} />
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} MaaCare. Built with care.</p>
          <p>EN · বাংলা · Always consult a qualified clinician for medical advice.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((i) => <li key={i}><a href="#" className="hover:text-foreground">{i}</a></li>)}
      </ul>
    </div>
  );
}
