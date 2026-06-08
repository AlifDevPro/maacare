# System design

MaaCare is a single Next.js application. The browser runs React pages; the server handles APIs, AI, and database access. Supabase provides authentication, Postgres, file storage, and optional realtime updates.

## Main parts

**Browser:** pages, forms, chat UI, language switcher, and Supabase realtime where enabled.

**Next.js server:** route handlers under `/api`, server-rendered pages, and session refresh via `src/proxy.ts`.

**Supabase:** user accounts, all structured health and community data, vector search for the knowledge library, and storage for avatars and community images.

**AI providers:** Google Gemini for chat and embeddings; Groq as backup and for translation. Keys stay on the server only.

**Firebase:** web push notifications when configured.

## Frontend layout

User-facing routes live under `src/app/`. Examples include `/app` (home), `/chat`, `/vitals`, `/symptoms`, `/community`, `/reports`, `/profile`, and `/settings`. Marketing and auth pages (`/`, `/login`, `/signup`) are public. Documentation at `/docs` is also public.

Bottom navigation on mobile typically includes Home, Chat, Symptoms, Emergency, Community, and Profile.

Signed-in pages often load session data on the server first. Chat and signup AI screens run fully in the browser and call APIs.

## Backend layout

There are roughly **94 API routes** under `src/app/api/`. Business logic sits in `src/lib/` (auth, AI, reports, push, facilities, and more).

Every protected API checks the session from cookies. Admin APIs additionally require an admin role on the user profile.

## Database (summary)

Data is stored in Supabase Postgres with row-level security. Major groups:

**Identity:** `profiles` linked to Supabase Auth users.

**Health:** pregnancy profiles, vitals, symptom logs, appointments, planner logs, wellbeing check-ins, conditions, allergies, medications.

**AI chat:** `ai_chat_conversations` and `ai_chat_messages`, including a stored language tag per conversation.

**Knowledge:** `rag_documents` and `rag_chunks` with 768-dimensional embeddings for semantic search.

**Reports:** `user_medical_reports` and per-user report chunks for chat retrieval.

**Community:** posts, comments, likes, and moderation reports.

**Messages:** direct message conversations and participants.

**Care links:** `care_relationships` for shared visibility between subject and viewer.

**Operations:** notifications, feedback, feature flags, push subscriptions, and a push queue.

**Reference:** Bangladesh health facilities for nearby search.

Storage buckets cover avatars, community post images, and developer team photos.

Migrations are in `supabase/migrations/` (44 files at time of writing).

## API groups

| Area | Examples |
|------|----------|
| Auth | login, logout, session, email check, password update |
| Profile & health | profile, vitals, symptoms, appointments, planner |
| AI | chat, conversations, signup AI turn |
| Reports | analyze, list, detail, reprocess |
| Community | posts, comments, likes, reports |
| Messages | conversations, messages, peer search |
| Care | care relationship invite and accept |
| Push | subscribe, config, cron dispatch |
| Admin | users, knowledge ingest, moderation, docs CMS, settings |
| Public | team directory, docs runtime, signup AI (rate limited) |

Full endpoint detail is in the [API reference](/docs/api).

## Request path (chat example)

1. The signed-in client sends a message to `POST /api/chat`.
2. The server loads the user profile and optional conversation language.
3. Language is detected or kept stable across short replies.
4. The user message may be translated to English internally for search.
5. Intent is classified; relevant knowledge and personal context are fetched.
6. Gemini generates a reply; Groq is used if Gemini fails.
7. A quality check may retry once if the answer is empty or off-topic.
8. The turn is saved to the conversation history.
9. JSON returns the reply, provider name, and optional citations.

## Scalability notes

API routes can scale horizontally on serverless hosting. Database and vector search scale with the Supabase plan. AI latency is managed with transcript limits, caching for knowledge search, and parallel fetches where enabled. Signup AI rate limits use an in-memory counter per server instance; a shared store would be needed for multi-region consistency.
