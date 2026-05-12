# BuildFest — “Vibe to Production in 180 Seconds” (MaaCare)

Use this for your **3-minute preliminary video**. Read at a calm pace (~130–150 words/min); if you run long, trim the optional sentences in brackets.

---

## Slide deck (titles + what to show)

| # | Slide title | On-screen capture / demo |
|---|-------------|----------------------------|
| 1 | **MaaCare** — AI-native maternal companion | Logo / home (`/app`) — calm, mobile frame |
| 2 | **The problem** — care between clinic walls | Stock or simple graphic: map BD + “gaps in continuity of care” (optional) |
| 3 | **Who we serve** — Bangladesh + global | Text bullet: pregnant users, caregivers, Bangla + English |
| 4 | **Our thesis** — grounded AI, not vibes | One line: “LLM + RAG + your journey context” |
| 5 | **Live demo** — Ask MaaCare | **Chat** (`/chat`) — one question |
| 6 | **Live demo** — বাংলায় জিজ্ঞাসা | Same chat — **Bangla** question (or Profile language `bn`) |
| 7 | **Live demo** — profile → personalized context | **Profile** (`/profile`) → pregnancy / prefs → back to chat |
| 8 | **Live demo** — community + trust | **Community** (`/community`) → post → thread / like |
| 9 | **Architecture** — layers in 15 seconds | Simple diagram (below) or split-screen: UI / API / Supabase / LLM |
| 10 | **AI depth** — Gemini + Groq + RAG | Bullets: failover, `rag_chunks`, RLS |
| 11 | **Impact & KPIs** — why it scales | 3 metrics + “pilot with clinic/NGO” |
| 12 | **Ask** — BuildFest champion (medical segment) | Team + QR / link + “thank you” |

**Diagram (copy to slide or Excalidraw):**

```text
[ User ] → Next.js UI (en / bn)
              ↓
       API routes (auth, Zod)
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Supabase            LLM layer
(Postgres,          Gemini →
 RLS, Storage,      Groq failover
 Realtime)              ↓
    ↑              Markdown reply
 RAG retrieval
 (pgvector chunks)
```

---

## 180-second word-for-word script

**0:00–0:30 — Problem**

“Good day. We’re **MaaCare** — an **AI-native companion** for pregnancy and early motherhood.

In Bangladesh and similar settings, millions of families get **strong care in the clinic** — but **weak continuity** between visits: questions stack up, advice is fragmented, and trusted information is often **English-first** or scattered across social media.

Generic chatbots make this worse: they **hallucinate**, ignore context, and erode trust.

**MaaCare exists because this problem deserves systems that are personalized, localized, and grounded — not another slide deck.**”

*(Cut if tight: drop the last sentence.)*

---

**0:30–1:00 — Solution**

“We built a **production-shaped web app**: a guided **AI assistant**, a **community** for peer support, and a **profile layer** that carries pregnancy and health context safely.

Users interact in **English or Bangla**. The assistant is designed for **education and navigation** — when to worry, what to track, what to ask a clinician — **not** to replace doctors.

What makes us **AI-native**, not ‘AI-sticker’: every answer can be shaped by **retrieved knowledge** and **structured user context**, with **secure data** behind row-level security on Supabase.

**In one line: MaaCare is vibe plus engineering — an actual path from question to grounded response.**”

---

**1:00–2:00 — Demo / concept flow**

“Let me show you.

**First — Chat.** I’ll ask a common pregnancy question…  
*(type / voice-over)* …you see a clear, structured reply.

**Second — Bangla.** Same intent in **Bangla** — the product must work for **real users**, not only demo English.

**Third — Personalization.** Here’s **Profile**: language, notifications, pregnancy journey fields. When the user returns to chat, the model route can use **this context** — gestational week, vitals snapshot hooks — so answers aren’t generic.

**Fourth — Community.** Posts, **threaded replies**, likes — and **in-app notifications** when someone engages. We’ve wired **Supabase Realtime** so the feed feels alive without spamming refreshes.

That’s the loop: **ask → grounded answer → save context → connect with peers.**”

*(If short on time: skip “Fourth” detail; show community for 15s only.)*

---

**2:00–2:30 — AI approach**

“Under the hood we match the **BuildFest AI reference architecture**:

- **Knowledge retrieval:** curated documents chunked into **Postgres + pgvector-style RAG** — retrieval before generation.
- **Models:** **Google Gemini** primary with **Groq failover** — resilience under rate limits, not a single point of failure.
- **Orchestration:** the chat route is a **pipeline**: authenticate, assemble context, optionally retrieve chunks, then generate.
- **Data plane:** **Supabase** — auth, relational health and community data, **RLS** so users only see their rows, **Storage** for avatars and rich posts, **SQL triggers** for notifications.

That’s **real AI thinking**: retrieval, failover, security, and product UX in one stack.”

---

**2:30–3:00 — Impact & next step**

“Impact we’re built to measure: **weekly engaged users**, **sessions per user**, **Bangla vs English usage**, and **safe escalation** — how often we surface ‘seek urgent care’ style guidance when symptoms are serious.

Next steps: expand the **clinician-reviewed RAG corpus**, run a **pilot** with one clinic or maternal-health NGO in Bangladesh, and harden evaluation — automated checks plus human review on a golden question set.

We’re not claiming a finished hospital system — we’re claiming a **credible, buildable foundation** for **grounded, localized maternal AI**.

**MaaCare — thank you. We’d love to represent the medical segment as BuildFest champions.**”

---

## Timing cheat sheet

| Block | Seconds | ~Words (guideline) |
|-------|---------|---------------------|
| Problem | 30 | 90–110 |
| Solution | 30 | 90–110 |
| Demo | 60 | 140–180 (tight; rehearse clicks) |
| AI approach | 30 | 110–130 |
| Impact | 30 | 90–110 |

**Rehearsal tip:** Record once; if you’re at **3:15**, cut Bangla **or** one community beat — keep problem + AI stack + one strong demo.

---

## Mandatory checklist (organizer rubric)

- [x] 3-minute structured video — segments above  
- [x] Clear problem + user — opening block  
- [x] AI-native — RAG + LLM + failover + context  
- [x] Basic flow — diagram + demo path  
- [x] Initial demo — chat + profile + community  
- [x] Bangla / localization — explicit demo + settings  
- [x] Impact / KPIs — closing block  

---

## Screenshots to capture before recording (checklist)

1. `/app` or home — hero frame with app name  
2. `/chat` — empty or seed state + your best answer  
3. `/chat` — same with Bangla input visible  
4. `/profile` — language + extended community toggle visible (blur PII if needed)  
5. `/community` — feed with cards  
6. `/community/{postId}` — threaded replies (optional 2s)  
7. Notifications sheet or bell with badge (optional)  
8. One architecture slide (template above)

---

*Generated for the MaaCare / maacare-platform repo. Tweak names and KPIs to match your team story.*
