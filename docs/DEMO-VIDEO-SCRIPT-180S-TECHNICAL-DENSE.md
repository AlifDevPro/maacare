# 180s Demo Video — Technical-Dense Script (MaaCare)

**Use when:** judges want **architecture, algorithms, and AI pipelines**, not only product vibes.  
**Pace:** rehearse at **~135–145 spoken words/min**; this draft is **tight**—use **[CUT]** blocks if you run over 3:00.  
**Full eight-pillar inventory + engineering detail:** [`docs/JUDGE-PANEL-TECHNICAL-BRIEF.md`](./JUDGE-PANEL-TECHNICAL-BRIEF.md) §**1b** (use as slide deck or teleprompter appendix).

---

## The eight pillars (say this list once in Solution or Demo)

1. **AI-powered personalized health chat** (`/chat`) — RAG + journey context + Bangla + voice.  
2. **Home** (`/app`) — resolver-driven pregnancy/vitals/symptoms/appts + persona UI flags.  
3. **Symptom analyzer** — logs + **RAG-grounded** insights and JSON next steps.  
4. **Report simplifier** (`/reports`) — server-side document analysis.  
5. **Emergency + hospital + pharmacy finder** (`/emergency`, `/facilities`) — BD catalog + optional chat injection.  
6. **Community + user-to-user messaging** (`/community`, **`/messages`**) — threaded posts + **1:1 DMs** + Realtime.  
7. **Advanced admin panel** (`/admin`) — users, knowledge corpus, moderation, team directory.  
8. **Postpartum** (`/postpartum`) — week/mood-aware UX + **cached RAG-backed** AI insights.

---

## Segment map (submission rubric)

| Time | Segment | Evaluator bar |
|------|---------|----------------|
| 0:00–0:30 | Problem + users + urgency | Clarity, relevance (BD + global) |
| 0:30–1:00 | Solution + **all eight pillars** + differentiation | Simplicity, uniqueness |
| 1:00–2:00 | Demo / system walkthrough | Feasibility, logic |
| 2:00–2:30 | AI approach (models, RAG, data, personalization) | Depth, structure |
| 2:30–3:00 | Impact, KPIs, next step | Vision, potential |

**Mandatory checklist (say or show each once):** problem/users · AI-native (LLM+RAG+structure) · **input → AI → output** flow · demo/prototype · **Bangla / localization** · impact/KPIs.

---

## On-screen cheat sheet (optional lower-third / slide)

| Time | Lower-third (max 8 words) |
|------|---------------------------|
| 0:00 | Maternal continuity gap · BD + global |
| 0:30 | **8 pillars** · RAG · RLS · Supabase |
| 1:00 | Montage: Chat Home Symptom Report Emerg Comm Admin PP |
| 2:00 | Embed → pgvector → Gemini→Groq |
| 2:30 | KPIs · pilot · corpus eval |

---

## 0:00 – 0:30 · Problem (The Vibe)

**Say:**

“BuildFest team—**MaaCare**: an **AI-native** companion for **pregnancy through postpartum**.

**Who:** expecting parents and caregivers—especially in **Bangladesh**, where clinic visits are strong but **between-visit continuity** breaks: questions pile up, advice is **English-first** or scattered on social feeds, and **trust** is fragile.

**Why now:** generic LLMs **hallucinate** and ignore longitudinal context—so families either get unsafe answers or stop asking.

**We treat this as a systems problem:** localized UX, **grounded retrieval**, and **privacy-aware** health data—not a chat wrapper.”

**[CUT if long]:** entire last sentence after “fragile.”

**Show (B-roll or static):** map graphic BD + “continuity of care”; or home hero `/app` blurred.

---

## 0:30 – 1:00 · Solution + eight pillars + differentiation

**Say:**

“We shipped a **production-shaped Next.js app** on **Supabase**: Auth, **Postgres with row-level security**, Storage, optional **Realtime**.

**Eight integrated surfaces—not one feature:** **one**—**personalized health chat** with **RAG** and **citations**. **Two**—**Home** with **care-link resolvers** so partners see the right pregnancy row. **Three**—**symptom analyzer** with **retrieval-grounded** triage copy and JSON suggestions. **Four**—**report simplifier**. **Five**—**emergency** plus **hospital/clinic/pharmacy finder** on Bangladesh data. **Six**—**community** plus **private DMs** with RLS and Realtime. **Seven**—**admin** for corpus, users, moderation. **Eight**—**postpartum** with **cached** RAG insights.

**Differentiation:** every heavy LLM path is **server-side**; chat is **retrieve-then-generate** with **Gemini→Groq failover**; onboarding can be **wizard or AI chat** with **`DRAFT_PATCH`**—passwords **never** in the model.

**Bangla:** script + **Banglish** hints; retrieval can normalize to **English** for embeddings while the user still gets **Bangla** answers.”

**[CUT if long]:** shorten the numbered list to “chat, home, symptoms, reports, emergency and facilities, community and DMs, admin, postpartum—**all in repo**.”

**Show:** architecture still (UI → API → Supabase + LLM + RAG) — see `BUILDFEST-180S-PITCH.md` diagram.

---

## 1:00 – 2:00 · Demo montage (input → AI → output)

**Goal:** **hit each pillar visually** even if you only **spend 5–8 seconds** per URL (fast cursor, pre-logged-in account).

| Order | Show (route) | One-line voiceover |
|-------|----------------|-------------------|
| A | `/chat` | “**Input** question → **output** grounded reply + **citations**.” |
| A2 | `/chat` (Bangla) | “Same pipeline; **Bangla** out; English-normalized **embed** under the hood.” |
| B | `/app` | “**Home** pulls **parallel** health rows; partner path uses **`care_relationships`** resolvers.” |
| C | `/symptoms` → open one log | “**Symptom analyzer**: RAG **risk** text + **JSON** next steps—conservative.” |
| D | `/reports` | “**Report simplifier**—**server** analyze; keys never in browser.” |
| E | `/emergency` then `/facilities` (toggle **pharmacy**) | “**Emergency** UX + **OSM-backed** hospitals/clinics/**pharmacies**.” |
| F | `/community` → thread | “**Peer** posts and **threaded** replies—Realtime optional.” |
| G | `/messages` or start DM from member profile | “**User-to-user DMs**—`dm_*` tables, **RLS**, **Realtime** thread.” |
| H | `/admin` (blur sensitive) | “**Admin**—knowledge corpus, users, moderation, team.” |
| I | `/postpartum` | “**Postpartum**—RAG + **TTL-cached** insights.” |

**[CUT if long — keep this order of sacrifice]:** I postpartum → H admin (show logo only) → G DMs → F community depth → D reports (mention by name only).

**Never cut:** A chat + **A2 Bangla** + **B Home** + **E facilities/emergency** (proves BD + safety surfaces).

---

## 2:00 – 2:30 · AI approach (depth for evaluators)

**Say—four beats:**

“**Models:** **Gemini** primary; **Groq** **failover**; **multi-key** rotation on quota errors.

**RAG core:** **768-D** embeddings; **`match_rag_chunks_for_user`** on **`rag_chunks`**; category filters; **retrieve before generate** in **`/api/chat`**, symptoms, postpartum, planner food.

**Orchestration:** **Zod** on APIs; **transcript budgeting**; **parallel DB reads** for personalization; **voice** = different temperature + spoken rules.

**Data plane:** **RLS** everywhere; **DMs** and **care links** are first-class relational models—not hacks.”

**[CUT if long]:** drop planner food mention; keep **symptoms + postpartum + chat** as RAG triad.

**Show:** one slide with the four beats + optional `provider: "groq"` redacted log.

---

## 2:30 – 3:00 · Impact & next step

**Say:**

“**KPIs:** **WAU/MAU**, sessions per user, **Bangla share**, **RAG hit rate**, **citation coverage**, **DM and community engagement**, **symptom escalation** rate when red-flag language hits.

**Next:** expand **clinician-reviewed** corpus; **Bangladesh pilot** with clinic or maternal NGO; **golden eval** set with automated + human review.

**MaaCare**—eight pillars, one architecture: **real AI thinking**, **real users**, **real code**. Thank you.”

**[CUT if long]:** shorten KPI list.

**Show:** team + link/QR.

---

## “Input → AI → output” one-liner (memorize)

**Chat:** user text → normalize for embed (optional) → **embed** → **pgvector RPC** → **chunks + profile context** → **Gemini→Groq** → **answer + citations**.  
**Symptoms / postpartum:** structured user fields + **RAG** → **LLM** JSON or prose **only** on retrieved rules.

---

## Bangla / localization (rubric line—say explicitly)

“We detect **Unicode Bangla** and **Banglish** Latin tokens; retrieval can use **English-normalized** semantics; the **model answers in Bangla** when that’s the user’s language—**product and pipeline**, not translation bolt-on.”

---

## Timing rescue — if you are at 3:10 after rehearsal

**Cut order:** (1) postpartum + admin quick flashes → (2) DM clip → (3) community depth → (4) reports name-drop only → (5) trim eight-pillar list in Solution to one sentence.

**Never cut:** problem/users · **RAG + failover** · **chat + Bangla** · **Home** · **emergency/facilities** · **impact + pilot**.

---

## Optional “judge mic drop” lines (5s each—pick at most two)

- “**Eight pillars** in one Next.js monorepo—**chat RAG**, **Home resolvers**, **symptom JSON insights**, **reports**, **BD facilities**, **community + DMs**, **admin**, **postpartum cache**.”  
- “**DMs** are **`dm_conversations`** + **RLS** + **Realtime**—same security discipline as clinical tables.”  
- “Signup chat uses **`DRAFT_PATCH`** + **Zod**—passwords **out of band**.”  
- “**`care_relationships`** JSON permissions—partner reads pregnancy **only** when **active** and allowed.”

---

## File references (post-video deep dive)

| Topic | Doc / code |
|-------|----------------|
| **All eight pillars (tables)** | [`docs/JUDGE-PANEL-TECHNICAL-BRIEF.md`](./JUDGE-PANEL-TECHNICAL-BRIEF.md) §**1b** |
| Full architecture | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Lighter script + slide table | [`docs/BUILDFEST-180S-PITCH.md`](./BUILDFEST-180S-PITCH.md) |
| Chat + RAG | `src/app/api/chat/route.ts` |
| Home | `src/lib/app/home-data.ts`, `src/app/api/app/home/route.ts` |
| Symptom insights | `src/app/api/symptoms/log/[id]/route.ts` |
| Reports | `src/app/api/reports/analyze` |
| Emergency / facilities | `src/app/emergency/*`, `src/app/facilities/*`, `src/app/api/emergency/*`, `src/app/api/facilities/*` |
| Community | `src/app/community/*` |
| DMs | `src/app/messages/*`, `src/app/api/dm/*` |
| Admin | `src/app/admin/*`, `src/app/api/admin/*` |
| Postpartum AI | `src/lib/postpartum/ai-insights.ts` |
| RAG core | `src/lib/rag/service.ts` |
| Failover | `src/lib/gemini/text-failover.ts` |

---

*Rehearse with a stopwatch; montage beats beat long narration.*
