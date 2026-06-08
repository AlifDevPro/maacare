# Deployment and roadmap

This page covers how to run MaaCare in production, what is not built yet, and sensible next steps.

## Hosting

The app targets **Vercel** (or any Node host that runs `next build` and `next start`). The database and auth live in a **Supabase** project. Apply migrations from `supabase/migrations/` in order before going live.

Copy `.env.example` to `.env.local` for local work. In production, set the same variables in your host’s secret store.

## Required environment variables

**Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Site:** `NEXT_PUBLIC_SITE_URL`

**AI (at least one):** `GEMINI_API_KEY` and/or `GROQ_API_KEY`, plus optional model overrides (`GEMINI_CHAT_MODEL`, `GROQ_CHAT_MODEL`, and others listed in `.env.example`)

**Multilingual pipeline:** `MULTILINGUAL_PIPELINE_ENABLED` (default on)

**Push (optional):** Firebase `NEXT_PUBLIC_FIREBASE_*` and a service account (`FIREBASE_SERVICE_ACCOUNT_JSON` or file path)

**Cron:** `CRON_SECRET` for `/api/cron/push-dispatch`

Additional flags used in code but not in `.env.example` include `MCP_ENABLED`, `AI_DEBUG_METADATA`, `CHAT_PERF_DEBUG`, and `SIGNUP_AI_MAX_PER_IP_PER_MIN`.

## Local commands

```bash
npm install
npm run dev      # development at http://localhost:3000
npm run build    # production build check
npm run start    # production server
```

Helper scripts exist for importing Bangladesh facilities and running AI pipeline tests (`npm run test:multilingual`, and others in `package.json`).

## Current limitations

MaaCare is not certified as a medical device. There is no payment or subscription system. Native iOS and Android apps are not shipped; the web app may behave as a PWA. Google sign-in sends new users to the app without a full profile wizard today. Gemini Maps integration is a placeholder. Push cron on Vercel Hobby runs at most once per day unless you upgrade the plan.

Offline use is limited; AI and sync need a network connection.

## Trade-offs in this version

A monolithic Next.js app keeps deployment simple for a hackathon or pilot. Server-side AI protects keys and prompts. pgvector inside Postgres avoids a separate vector database. Groq failover improves uptime when Gemini is slow or unavailable.

## Roadmap ideas

Distributed rate limiting for signup AI and chat abuse prevention.

Profile wizard after Google OAuth for brand-new accounts.

Background jobs for very large PDF reports.

Expanded Bangla content in the knowledge library.

Partner dashboard improvements for care relationships.

Deeper PWA offline support beyond push notifications.

Clinician verification workflow (a `verified_professional` field exists; full workflow is not complete).

## Conclusion

MaaCare v0.1.0 delivers an end-to-end maternal health web experience: auth, tracking, bilingual AI, community, admin tools, and public documentation. With Supabase and AI keys configured, it is ready for demo, competition judging, and controlled pilot use. Clinical or regulated deployment would need separate compliance work beyond this release.
