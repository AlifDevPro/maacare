# MaaCare Platform — Advanced Architecture

This document describes the **as-built** architecture of the **maacare-platform** monorepo: Next.js (App Router), Supabase (Auth, Postgres, RLS, Storage, Realtime), multi-provider LLM chat with RAG, and supporting domains (community, vitals, symptoms, planner, admin).

---

## 1. System context (who talks to whom)

```mermaid
flowchart TB
  user[User]
  browser[BrowserReact]
  next[NextjsServer]
  supa[SupabaseAuthDbStorageRealtime]
  gemEmb[GeminiEmbeddingsREST]
  gemChat[GeminiGenerativeAIChat]
  groqChat[GroqOpenAICompatibleChat]
  user --> browser
  browser --> supa
  browser --> next
  next --> supa
  next --> gemEmb
  next --> gemChat
  next --> groqChat
```

- **Browser** runs the React client (including `createSupabaseBrowserClient` for auth-aware operations and **Realtime** subscriptions). The browser **does not** call Gemini or Groq directly; only **Next.js Route Handlers** hold API keys.
- **Next.js** server handles Route Handlers under `src/app/api/**`, server components, and `proxy` (see `src/proxy.ts`) for cookie session refresh and route gating.
- **Supabase** is the system of record: Auth, Postgres, Row Level Security, Storage buckets, optional **Realtime** publication on selected tables.
- **Gemini** is used for **chat completion** (`@google/generative-ai`), **embeddings** (REST `text-embedding-004` style, see `src/lib/gemini/embeddings.ts`), and a small **multilingual prep** call before RAG (`prepareMultilingualChatTurn` in [`src/lib/chat/multilingual-prep.ts`](src/lib/chat/multilingual-prep.ts) via `generateTextWithGeminiGroqFailover`).
- **Groq** (`https://api.groq.com/openai/v1/chat/completions`) is the **OpenAI-compatible fallback** when Gemini chat fails or returns empty text, using the same system/user envelope where possible (`src/lib/gemini/text-failover.ts`).

---

## 2. High-level containers

```mermaid
flowchart LR
  subgraph presentation [PresentationLayer]
    pages[AppRouterPages]
    components[ReactComponents]
    hooks[HooksRealtimeAuth]
  end
  subgraph application [ApplicationLayer]
    api[NextApiRoutes]
    lib[LibAuthRagGemini]
  end
  subgraph data [DataLayer]
    pg[(PostgresRLS)]
    storage[SupabaseStorage]
    rt[SupabaseRealtime]
    auth[SupabaseAuth]
  end
  subgraph intelligence [AIIntelligenceLayer]
    chatApi["POST api chat"]
    ragSearch["POST api rag search"]
    reports["POST api reports analyze"]
    embed[embedText Gemini768d]
    rpc[match_rag_chunks_for_user]
    llm[generateTextWithGeminiGroqFailover]
  end
  pages --> api
  components --> api
  hooks --> auth
  api --> pg
  api --> storage
  api --> auth
  hooks --> rt
  chatApi --> embed
  embed --> rpc
  rpc --> pg
  chatApi --> ragSearch
  ragSearch --> embed
  reports --> llm
  chatApi --> llm
  llm --> geminiExt[GoogleGeminiChat]
  llm --> groqExt[GroqChat]
```

---

## 3. Request path and security boundary

```mermaid
sequenceDiagram
  participant U as UserBrowser
  participant P as NextProxy
  participant R as ApiRoute
  participant S as SupabaseServerClient
  participant DB as Postgres
  U->>P: HTTPS request plus cookies
  P->>P: Refresh session cookies SSR
  U->>R: fetch api with credentials
  R->>S: createSupabaseServerClient cookies
  S->>DB: Query with JWT RLS
  DB-->>S: Rows allowed by policy
  S-->>R: Data
  R-->>U: JSON response
```

- **`getSessionFromCookies`** (see `src/lib/auth/get-session.ts`) is the gate for protected APIs.
- **RLS** enforces tenant isolation on almost all user tables; admin routes use a **service-role gate** pattern where applicable.
- **Auth roles on `profiles`:** `PATCH /api/profile` accepts only the allowlisted profile fields in `src/app/api/profile/route.ts`. The JSON body must **not** include `role`, `moderator`, or `verified_professional` (those keys are ignored by the schema and are not written from this route). New accounts receive `role = user` from the database default; **moderator** and **admin** are assigned only through admin surfaces (for example `src/app/admin/users/[userId]`), not from public signup or profile self-service.

---

## 4. Frontend map (App Router)

Major **user-facing** surfaces (non-exhaustive):

| Area | Routes / entry | Role |
|------|----------------|------|
| Marketing / entry | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-otp`, `/auth/callback` | Acquisition, PKCE auth |
| App shell | `/app` | Logged-in home |
| AI assistant | `/chat` | LLM conversation UI |
| Profile | `/profile`, `/profile/edit`, `/settings`, `/help` | Identity, prefs, Bangla |
| Health | `/vitals`, `/symptoms`, `/symptoms/result`, `/appointments`, `/planner`, `/postpartum` | Structured data capture |
| Community | `/community`, `/community/create`, `/community/[postId]`, `/community/member/[userId]` | Social, threaded replies |
| Safety | `/emergency`, `/facilities`, `/guidance/[topic]` | Information / wayfinding |
| Reports | `/reports` | Document analysis flow (separate API stack) |
| Notifications | `/notifications` | In-app list |
| Admin | `/admin`, `/admin/users`, `/admin/knowledge`, `/admin/community`, `/admin/feedback`, `/admin/settings` | Operations, RAG corpus |

**Shared UI:** `AppShell`, `AppHeader`, `BottomNav`, `NotificationBell` (Sheet + Realtime-driven refresh patterns where enabled).

---

## 5. API surface (Route Handlers)

Grouped by concern:

```mermaid
flowchart TB
  subgraph authApis [Auth]
    a1["/api/auth/session"]
    a2["/api/auth/login"]
    a3["/api/auth/logout"]
    a4["/api/auth/me"]
    a5["/api/auth/update-password"]
    a6["/api/auth/email-registered"]
  end
  subgraph coreApis [CoreUserData]
    p1["/api/profile"]
    h1["/api/app/home"]
    v1["/api/vitals"]
    s1["/api/symptoms/log"]
    ap1["/api/appointments"]
    pl1["/api/planner/daily"]
    pl2["/api/planner/food"]
  end
  subgraph aiApis [AI]
    c1["/api/chat"]
    c2["/api/chat/nearby-once"]
    r1["/api/rag/search"]
    r2["/api/rag/ingest"]
  end
  subgraph communityApis [Community]
    co1["/api/community/posts"]
    co2["/api/community/posts/postId"]
    co3["/api/community/posts/postId/comments"]
    co4["/api/community/posts/postId/like"]
    co5["/api/community/members/userId"]
    co6["/api/community/posts/postId/report"]
    co7["moderation routes"]
  end
  subgraph notifyApis [Notifications]
    n1["/api/notifications"]
    n2["/api/notifications/mark-read"]
  end
  subgraph adminApis [Admin]
    ad1["/api/admin/dashboard"]
    ad2["/api/admin/users"]
    ad3["/api/admin/knowledge/documents"]
    ad4["/api/admin/community"]
    ad5["/api/admin/feedback"]
    ad6["/api/admin/settings"]
  end
  subgraph miscApis [Misc]
    f1["/api/feedback"]
    f2["/api/facilities/nearby"]
    e1["/api/emergency/hospitals"]
    rep1["/api/reports/analyze"]
  end
```

---

## 6. AI chat, RAG, multilingual, and voice (full pipeline)

Primary implementation: **`POST /api/chat`** in [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts). Supporting modules: [`src/lib/rag/service.ts`](src/lib/rag/service.ts), [`src/lib/gemini/embeddings.ts`](src/lib/gemini/embeddings.ts), [`src/lib/gemini/text-failover.ts`](src/lib/gemini/text-failover.ts), [`src/lib/chat/multilingual-prep.ts`](src/lib/chat/multilingual-prep.ts), [`src/lib/bd-facilities/chat-nearby-context.ts`](src/lib/bd-facilities/chat-nearby-context.ts).

### 6.1 Sequence: one chat turn (happy path)

```mermaid
sequenceDiagram
  participant C as ClientChatUI
  participant API as NextRouteApiChat
  participant DB as SupabasePostgres
  participant Emb as GeminiEmbeddingAPI
  participant RPC as RpcMatchRagChunks
  participant LLM as GeminiThenGroqChat

  C->>API: POST JSON messages replyChannel userLocation reportContext
  API->>API: getSessionFromCookies plus Zod bodySchema
  API->>API: lastUser plus prepareMultilingualChatTurn
  API->>LLM: JSON language tag plus English retrieval query
  LLM-->>API: ietfLanguageTag englishRetrievalQuery optional hint
  API->>Emb: embedText on English retrieval query
  Emb-->>API: vector length 768
  API->>RPC: match_rag_chunks_for_user query_embedding
  RPC->>DB: pgvector similarity over rag_chunks
  DB-->>API: top hits with content and scores
  par Parallel health reads
    API->>DB: profiles pregnancy_profiles user_health_profiles
    API->>DB: medical_conditions allergies medications
    API->>DB: vital_signs symptom_logs planner_daily_logs appointments
    DB-->>API: rows for personalContext block
  end
  API->>API: buildBudgetedTranscript plus optional BD facilities block
  API->>API: optional reportContext JSON to text block
  API->>API: assemble systemInstruction and userMessage
  API->>LLM: generateTextWithGeminiGroqFailover final answer
  LLM-->>API: reply text and provider label
  API-->>C: JSON reply citations needsClientLocation
```

### 6.2 Flow: retrieval, context, and generation

```mermaid
flowchart TD
  start[POST api chat] --> auth[Session plus Zod validate]
  auth --> last[Pick last user message]
  last --> prep[prepareMultilingualChatTurn via LLM JSON Zod]
  prep --> emb[embedText Gemini embedding model]
  emb --> rpc[RPC match_rag_chunks_for_user]
  rpc --> hits[Ranked chunk hits limit 8]
  hits --> ctx[Format CONTEXT block from hits]
  auth --> par[Parallel Supabase selects]
  par --> pc[Build PERSONAL HEALTH CONTEXT string]
  last --> trn[buildBudgetedTranscript token budget]
  last --> near{Nearby facilities intent}
  near -->|yes plus coords| bd[buildNearbyFacilitiesContextForChat]
  near -->|yes no coords| hint[Prompt user to allow location]
  near -->|no| skipbd[Skip BD block]
  ctx --> asm[Assemble systemInstruction]
  pc --> asm
  trn --> usr[Assemble userMessage with latest original plus English retrieval line plus transcript]
  bd --> asm
  hint --> asm
  skipbd --> asm
  usr --> llm[generateTextWithGeminiGroqFailover]
  asm --> llm
  llm --> out[JSON reply provider citations]
```

### 6.3 Multilingual behavior (any language in, English RAG, reply in user language)

```mermaid
flowchart LR
  u[Latest user text] --> prep[prepareMultilingualChatTurn LLM JSON]
  prep --> tag[IETF language tag plus optional hint]
  prep --> qe[English retrieval query]
  qe --> e[Embed English query]
  e --> rpc[RAG RPC]
  tag --> sys[Dynamic system lines reply in user language]
  u --> usr[userMessage original plus English retrieval line]
  usr --> fin[Final LLM answer]
  sys --> fin
```

**Implementation details:**

- **Prep step:** [`prepareMultilingualChatTurn`](src/lib/chat/multilingual-prep.ts) calls **`generateTextWithGeminiGroqFailover`** once with a JSON-only contract: **`ietfLanguageTag`** (BCP-47), **`englishRetrievalQuery`** (concise English for embedding over the English-only corpus), optional **`languageHintForPrompt`**. The immediately prior **assistant** snippet (when present) is passed in to disambiguate very short user replies. Optional **`profiles.language`** (`en` / `bn`) is a **tie-breaker** for ambiguous short replies; **`applyReplyLanguageOverrides`** then corrects obvious mismatches (e.g. Latin-script English mis-tagged as Bangla, or Bengali script forcing Bangla).
- **Nearby facilities intent:** [`detectNearbyFacilitiesIntent`](src/lib/bd-facilities/chat-nearby-context.ts) runs on **both** the original latest user message and the **English retrieval query**; results are merged with [`mergeNearbyIntents`](src/lib/bd-facilities/chat-nearby-context.ts) so non-English questions still match after translation.
- **Validation / fallback:** Response is parsed with **Zod**; on failure the server falls back to **`en`** and uses the **raw** latest user message as the retrieval string so chat never hard-fails.
- **Retrieval:** `searchKnowledge` always embeds the **English retrieval query**; chunk text in Postgres remains English.
- **Final model:** `systemInstruction` tells the model to answer in the detected language while **CONTEXT** stays English; `userMessage` includes **original** latest turn plus the **English retrieval query** so intent is grounded without mentioning pipeline steps in the reply. A **BOUNDARIES** block covers harmful or off-topic requests calmly in the same reply language.

### 6.4 Voice channel (`replyChannel: "voice"`)

```mermaid
flowchart TD
  body[Request body replyChannel text or voice] --> v{Voice}
  v -->|no| tinst[Text system instructions paragraphs ok]
  v -->|yes| vblock[Append VOICE SPOKEN OUTPUT MODE block]
  vblock --> rules[No markdown no bullets short sentences warm tone]
  rules --> temp[Pass temperature 0.82 to failover]
  tinst --> temp2[Default model temperatures]
  temp --> llm[generateTextWithGeminiGroqFailover]
  temp2 --> llm
```

- **Schema:** `replyChannel` is `z.enum(["text", "voice"]).default("text")` on the chat route.
- **Prompting:** Extra system lines forbid markdown and encourage **one to three short sentences** suitable for TTS; acknowledges-only turns get a **single short line** policy.
- **Sampling:** Voice path passes **`temperature: 0.82`** into `generateTextWithGeminiGroqFailover` for slightly more varied spoken phrasing; text mode uses provider defaults unless overridden.

**Client-side voice:** Speech capture, playback, and any browser TTS live under `src/lib/voice/*` and chat UI components (not duplicated here); the **server contract** is the same `POST /api/chat` with `replyChannel: "voice"`.

### 6.5 Models and environment knobs

| Role | Default / typical | Config |
|------|-------------------|--------|
| **Chat completion (primary)** | `gemini-2.5-flash` | `GEMINI_CHAT_MODEL` (`getChatModelName` in `text-failover.ts`) |
| **Chat completion (fallback)** | `llama-3.1-8b-instant` on Groq | `GROQ_CHAT_MODEL` |
| **Embeddings for RAG** | `text-embedding-004`, **768-D** vector stored in Postgres | `GEMINI_EMBEDDING_MODEL` (`embeddings.ts`) |
| **RAG match RPC** | `match_rag_chunks_for_user` | Defined in Supabase SQL migrations; called from `searchKnowledge` |

### 6.6 Provider failover (chat and multilingual prep)

```mermaid
flowchart TD
  in[System plus user messages] --> loopG[For each GEMINI_API_KEY]
  loopG --> tryG[generateWithGemini]
  tryG -->|ok non empty| doneG[Return gemini]
  tryG -->|rate limit| nextG[Next Gemini key]
  tryG -->|fatal| breakG[Stop Gemini attempts]
  nextG --> loopG
  loopG -->|exhausted| loopQ[For each GROQ_API_KEY]
  loopQ --> tryQ[generateWithGroq OpenAI compatible]
  tryQ -->|ok| doneQ[Return groq]
  tryQ -->|rate limit| nextQ[Next Groq key]
  tryQ -->|fatal| breakQ[Stop Groq attempts]
```

- **Gemini keys:** Tried in order; **429 / quota** errors continue to the next key; other errors can short-circuit the Gemini loop (see `generateTextWithGeminiGroqFailover`).
- **Groq keys:** Same pattern after all Gemini attempts fail or return empty.
- **Same helper** powers the **full chat answer** and the **multilingual prep** JSON step (language tag + English retrieval query), so operational behavior (keys, models, limits) stays consistent.

### 6.7 Context, safety, and budgets

- **Transcript:** `buildBudgetedTranscript` walks messages **newest-first**, clipping each message to `MAX_MESSAGE_CHARS_IN_TRANSCRIPT` and stopping when estimated tokens exceed `MAX_TRANSCRIPT_TOKENS` (heuristic `chars / 4`).
- **Personal block:** Concatenates DOB-derived age, pregnancy week and risk flags, latest vitals and symptom log summaries, recent planner and appointment strings, conditions, allergies, meds, and notes — all from **RLS-scoped** `select` calls under the user id.
- **RAG context:** Up to **8** chunks; formatted with numbered sources; empty hit list still yields an explicit “no internal articles” instruction so the model answers conservatively.
- **Report handoff:** Optional `reportContext` JSON is parsed server-side into a **REPORT CONTEXT** block (title, summary, findings, recommendations) when the user navigates from the reports flow.
- **Bangladesh facilities:** `detectNearbyFacilitiesIntent` on the latest user text; if intent matches and `userLocation` is present, `buildNearbyFacilitiesContextForChat` queries the **BD catalog** in Supabase; otherwise the model is instructed to ask for **location permission** once (`needsClientLocation` in the JSON response).

---

## 7. Knowledge (RAG) subsystem

```mermaid
flowchart TB
  subgraph adminWrite [Admin or ingest API]
    adm[POST api rag ingest or admin knowledge routes]
    adm --> docRow[Insert rag_documents]
    adm --> split[Chunk text per ingestDocumentWithChunks]
    split --> embW[embedText per chunk]
    embW --> insC[Insert rag_chunks with embedding vector768]
  end
  subgraph runtimeRead [Runtime chat or rag search]
    q[User or API query string]
    q --> embR[embedText query]
    embR --> rpc[RPC match_rag_chunks_for_user]
    rpc --> vec[pgvector cosine similarity]
    vec --> hits[Chunk rows plus similarity score]
  end
  docRow --> insC
```

- **Tables:** `rag_documents`, `rag_chunks` (column `embedding` aligned with **pgvector** / `GEMINI_EMBEDDING_DIMENSIONS` = 768), created and indexed via `supabase/migrations/`.
- **Service layer:** [`src/lib/rag/service.ts`](src/lib/rag/service.ts) — `ingestKnowledgeChunk`, `ingestDocumentWithChunks`, **`searchKnowledge`** (embeds query, calls **`match_rag_chunks_for_user`** with `match_count`, `min_similarity`, optional `filter_categories`).
- **Admin HTTP:** `src/app/api/admin/knowledge/documents/**` for CRUD / batch operations (gated by admin role).
- **User search API:** `POST /api/rag/search` — authenticated semantic search over the same RPC stack (for tools and future UI outside chat).

### 7.1 Related: medical report analysis pipeline (separate from live chat RAG)

- **Routes:** `POST /api/reports/analyze`, `POST /api/reports/extract-local` — document upload / OCR style flows with their own prompts and provider usage (see route sources under `src/app/api/reports/`).
- **Chat bridge:** Analyzed report payloads may be passed into **`POST /api/chat`** as `reportContext` so the assistant can discuss the same structured summary inside the normal chat guardrails.

---

## 8. Community domain

```mermaid
erDiagram
  PROFILES ||--o{ COMMUNITY_POSTS : authors
  COMMUNITY_POSTS ||--o{ COMMUNITY_COMMENTS : has
  COMMUNITY_POSTS ||--o{ COMMUNITY_POST_LIKES : has
  COMMUNITY_POSTS ||--o{ COMMUNITY_POST_REPORTS : optional
  PROFILES ||--o{ NOTIFICATIONS : receives
```

- **Feed & CRUD:** `/api/community/posts` with search, sort, `forYou` hints.
- **Threaded comments:** `parent_comment_id` tree built client-side; post detail uses **`CommunityCommentThread`** component.
- **Likes:** `community_post_likes` + triggers for optional author notifications.
- **Moderation:** RPCs / routes for moderators hiding posts or comments.
- **Member profiles:** `/api/community/members/[userId]` — public-safe fields; pregnancy snippet when **`community_show_extended_profile`** + RLS policy allows read.
- **Realtime (optional):** `postgres_changes` subscriptions in `src/hooks/use-*-realtime.ts` after tables are added to **`supabase_realtime`** publication (migration `20260516120000_*`).

---

## 9. Notifications

- **Table:** `notifications` (kinds e.g. community reply / like / system / reminder).
- **Authoring:** SQL triggers on `community_comments` / `community_post_likes` insert into `notifications` for post authors (see migrations `20250515000000_*`, `20250517000000_*`).
- **API:** `GET /api/notifications`, `POST /api/notifications/mark-read` (per-id or `all: true`).
- **Client:** `NotificationBell` (full-height Sheet), `NOTIFICATIONS_UPDATED_EVENT` for cross-component refresh.

---

## 10. Data model (Postgres — conceptual clusters)

**Identity & profile**

- `profiles` (display, role, language, avatar, prefs, `community_show_extended_profile`, …)
- `auth.users` (Supabase managed)

**Health & journey**

- `pregnancy_profiles`, `user_health_profiles`, `vital_signs`, `symptom_logs`, `appointments`, `planner_daily_logs`, …

**Community**

- `community_posts`, `community_comments`, `community_post_likes`, `community_post_reports`, …

**AI knowledge**

- `rag_documents`, `rag_chunks` (+ vector index via pgvector extension in schema)

**Ops**

- `app_feedback`, admin feature flags, etc.

**Storage buckets (examples)**

- Avatars, community post images (see `supabase/migrations/*storage*.sql`).

---

## 11. Client ↔ Supabase Realtime

When enabled in DB and wired in UI:

```mermaid
flowchart LR
  subgraph tables [RealtimePublication]
    t1[notifications]
    t2[community_comments]
    t3[community_post_likes]
    t4[community_posts]
  end
  subgraph hooks [ReactHooks]
    h1[useNotificationsRealtime]
    h2[useCommunityPostRealtime]
    h3[useCommunityFeedRealtime]
  end
  tables --> hooks
  hooks --> ui[RefetchOrPatchUI]
```

RLS still applies: clients only receive changes for rows they could `SELECT` with the current JWT.

---

## 12. Admin plane

- **UI:** `src/app/admin/**` — dashboard, users, knowledge corpus, community moderation queue, feedback inbox, settings.
- **API:** `/api/admin/**` — uses **elevated** access pattern (service role or role checks via `lib/admin` patterns) — always server-side.
- **User moderation:** community reports, ban/confirm email flows under `api/admin/users/...`.

---

## 13. Cross-cutting concerns

| Concern | Implementation |
|---------|----------------|
| Validation | **Zod** on API bodies (`route.ts` files) |
| Errors | `failJson`, `serverErrorJson`, `validationJsonResponse` (`src/lib/api/error-response.ts`) |
| Theming | `src/lib/theme.ts` (localStorage + `document.documentElement.classList`) |
| Voice | `src/lib/voice/*`, `VoiceCallPanel`; chat **`replyChannel: "voice"`** on `POST /api/chat` (spoken-style system prompt + higher temperature) |
| i18n prefs | Profile `language` `en` \| `bn` + UI copy patterns |
| Mobile UX | Touch targets, `touch-manipulation`, safe-area insets, bottom nav |

---

## 14. Deployment topology (typical)

```mermaid
flowchart TB
  subgraph vercel [VercelOrSimilar]
    next[NextjsServerAndStatic]
  end
  subgraph supabaseProj [SupabaseHosted]
    authSvc[GoTrue]
    dbSvc[Postgres]
    stSvc[Storage]
    rtSvc[Realtime]
  end
  users[Users] --> next
  next --> authSvc
  next --> dbSvc
  next --> stSvc
  browser[Browser] --> rtSvc
  browser --> authSvc
```

**Environment variables (conceptual):**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client + server anon access.
- `SUPABASE_SERVICE_ROLE_KEY` — **server only** (admin, bulk jobs, optional pregnancy read before RLS extension — prefer RLS policies over broad service use).
- `GEMINI_*`, `GROQ_*` — LLM + embeddings.

---

## 15. Evolution roadmap (architecture hooks)

- **Observability:** structured logging, tracing on `/api/chat` latency and RAG hit rate.
- **Evaluation:** golden dataset for Bangla/English safety and medical disclaimer compliance.
- **Agentic layer:** formalize tool-calling (calendar, triage checklist) behind the same session gate.
- **FHIR / export:** batch export for research pilots (new module, same auth).

---

## Document maintenance

When you add a major route or API:

1. Update **Section 4** (pages) and **Section 5** (API groups).
2. If you add a new external dependency, update **Section 1–2**.
3. If schema or **AI pipeline** changes, update **Section 6–7** and the in-app mirror `src/content/docs/architecture.md`.

---

*Generated from repository layout and key modules under `src/app`, `src/lib`, and `supabase/migrations`. For the hackathon pitch, cross-link with `docs/BUILDFEST-180S-PITCH.md`.*
