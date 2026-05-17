import type { Metadata } from "next";

import { createPageMetadata } from "@/lib/seo/metadata";

/** Shared metadata exports for route `layout.tsx` files. */
export const routeMetadata = {
  home: (): Metadata =>
    createPageMetadata({
      title: "AI Maternal Health Companion",
      description:
        "Free AI pregnancy guidance, symptom checks, emergency maps, and a supportive mother community — in English and Bangla.",
      path: "/",
    }),

  login: (): Metadata =>
    createPageMetadata({
      title: "Log in",
      description: "Sign in to your MaaCare account for personalized maternal health guidance.",
      path: "/login",
      noIndex: true,
    }),

  signup: (): Metadata =>
    createPageMetadata({
      title: "Sign up",
      description: "Create your free MaaCare account in under a minute.",
      path: "/signup",
    }),

  forgotPassword: (): Metadata =>
    createPageMetadata({
      title: "Forgot password",
      description: "Reset your MaaCare account password.",
      noIndex: true,
    }),

  resetPassword: (): Metadata =>
    createPageMetadata({
      title: "Reset password",
      description: "Choose a new password for your MaaCare account.",
      noIndex: true,
    }),

  verifyOtp: (): Metadata =>
    createPageMetadata({
      title: "Verify email",
      description: "Confirm your email to activate your MaaCare account.",
      noIndex: true,
    }),

  appHome: (): Metadata =>
    createPageMetadata({
      title: "Home",
      description: "Your personalized maternal health dashboard.",
      path: "/app",
      noIndex: true,
    }),

  community: (): Metadata =>
    createPageMetadata({
      title: "Community",
      description: "Connect with other mothers — questions, tips, and support.",
      noIndex: true,
    }),

  chat: (): Metadata =>
    createPageMetadata({
      title: "AI Chat",
      description: "Ask MaaCare AI about pregnancy, symptoms, and wellness.",
      noIndex: true,
    }),

  symptoms: (): Metadata =>
    createPageMetadata({
      title: "Symptom check",
      description: "Quick pregnancy symptom triage with clear guidance.",
      path: "/symptoms",
    }),

  emergency: (): Metadata =>
    createPageMetadata({
      title: "Emergency help",
      description: "Nearby clinics, hospitals, and pharmacies for maternity and urgent care.",
      path: "/emergency",
    }),

  facilities: (): Metadata =>
    createPageMetadata({
      title: "Nearby facilities",
      description: "Find hospitals and clinics near you.",
      path: "/facilities",
    }),

  planner: (): Metadata =>
    createPageMetadata({
      title: "Planner",
      description: "Daily hydration, nutrition, and pregnancy milestones.",
      noIndex: true,
    }),

  reports: (): Metadata =>
    createPageMetadata({
      title: "Report simplifier",
      description: "Upload medical reports and get plain-language summaries.",
      noIndex: true,
    }),

  profile: (): Metadata =>
    createPageMetadata({
      title: "Profile",
      description: "Your MaaCare profile and health journey.",
      noIndex: true,
    }),

  settings: (): Metadata =>
    createPageMetadata({
      title: "Settings",
      description: "Account and app preferences.",
      noIndex: true,
    }),

  notifications: (): Metadata =>
    createPageMetadata({
      title: "Notifications",
      description: "Likes, comments, and updates from your community.",
      noIndex: true,
    }),

  messages: (): Metadata =>
    createPageMetadata({
      title: "Messages",
      description: "Private messages on MaaCare.",
      noIndex: true,
    }),

  help: (): Metadata =>
    createPageMetadata({
      title: "Help",
      description: "Get help using MaaCare.",
      path: "/help",
    }),

  vitals: (): Metadata =>
    createPageMetadata({
      title: "Vitals",
      description: "Track blood pressure, weight, and other vitals.",
      noIndex: true,
    }),

  appointments: (): Metadata =>
    createPageMetadata({
      title: "Appointments",
      description: "Manage your care appointments.",
      noIndex: true,
    }),

  postpartum: (): Metadata =>
    createPageMetadata({
      title: "Postpartum",
      description: "Recovery insights and support after birth.",
      noIndex: true,
    }),

  admin: (): Metadata =>
    createPageMetadata({
      title: "Admin",
      description: "MaaCare administration.",
      noIndex: true,
    }),
} as const;
