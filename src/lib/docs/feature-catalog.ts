export type FeatureEntry = {
  title: string;
  href: string;
  description: string;
  /** Related API groups or paths for cross-linking from docs. */
  relatedApis?: string[];
};

export const FEATURE_CATALOG: FeatureEntry[] = [
  {
    title: "Home & dashboard",
    href: "/app",
    description: "Signed-in landing with shortcuts to health tools, chat, and community.",
    relatedApis: ["/api/app/home"],
  },
  {
    title: "AI chat",
    href: "/chat",
    description: "Conversational guidance with retrieval-augmented knowledge, Bangla/English support, optional voice mode.",
    relatedApis: ["/api/chat", "/api/rag/search"],
  },
  {
    title: "Profile & settings",
    href: "/profile",
    description: "Display name, avatar, pregnancy context, language (English / বাংলা), and community visibility preferences.",
    relatedApis: ["/api/profile", "/api/auth/me"],
  },
  {
    title: "Settings & help",
    href: "/settings",
    description: "Account preferences and links to help. Use Help for support email when configured.",
    relatedApis: [],
  },
  {
    title: "Vitals",
    href: "/vitals",
    description: "Log and review blood pressure, weight, and related vitals over time.",
    relatedApis: ["/api/vitals"],
  },
  {
    title: "Symptom check",
    href: "/symptoms",
    description: "Structured symptom logging and severity-oriented guidance (educational, not a diagnosis).",
    relatedApis: ["/api/symptoms/log"],
  },
  {
    title: "Planner",
    href: "/planner",
    description: "Daily hydration/nutrition-style planning tied to your journey.",
    relatedApis: ["/api/planner/daily", "/api/planner/food"],
  },
  {
    title: "Appointments",
    href: "/appointments",
    description: "Keep track of upcoming visits with your care team.",
    relatedApis: ["/api/appointments"],
  },
  {
    title: "Medical reports",
    href: "/reports",
    description: "Upload or capture reports for plain-language summaries (uses AI on the server).",
    relatedApis: ["/api/reports/analyze", "/api/reports/extract-local"],
  },
  {
    title: "Emergency & hotlines",
    href: "/emergency",
    description: "Public safety information and quick access to emergency numbers (also reachable without signing in).",
    relatedApis: ["/api/emergency/hospitals"],
  },
  {
    title: "Facilities nearby",
    href: "/facilities",
    description: "Location-aware discovery of nearby facilities where supported.",
    relatedApis: ["/api/facilities/nearby"],
  },
  {
    title: "Guidance topics",
    href: "/guidance/hydration",
    description: "Curated educational topics for pregnancy and postpartum (e.g. hydration, movement).",
    relatedApis: [],
  },
  {
    title: "Community feed",
    href: "/community",
    description: "Browse posts, react with likes, and open threaded discussions.",
    relatedApis: ["/api/community/posts"],
  },
  {
    title: "Create post",
    href: "/community/create",
    description: "Rich-text posts with optional images (storage-backed when enabled).",
    relatedApis: ["/api/community/posts"],
  },
  {
    title: "Post detail & comments",
    href: "/community",
    description: "Threaded comments on a post; realtime updates when publication is configured.",
    relatedApis: ["/api/community/posts/[postId]", "/api/community/posts/[postId]/comments"],
  },
  {
    title: "Member profiles",
    href: "/community",
    description: "Community member cards with optional extended pregnancy visibility when the member opts in.",
    relatedApis: ["/api/community/members/[userId]"],
  },
  {
    title: "Notifications",
    href: "/notifications",
    description: "In-app notifications for community activity and system messages.",
    relatedApis: ["/api/notifications", "/api/notifications/mark-read"],
  },
  {
    title: "Postpartum",
    href: "/postpartum",
    description: "Resources and tracking oriented to the fourth trimester.",
    relatedApis: [],
  },
  {
    title: "Admin console",
    href: "/admin",
    description: "Operator dashboard: users, knowledge corpus, community moderation, feedback triage (admin role only).",
    relatedApis: ["/api/admin/dashboard"],
  },
];
