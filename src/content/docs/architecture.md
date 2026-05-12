# Architecture (in-app summary)

MaaCare is **Next.js (App Router)** plus **Supabase** (Auth, Postgres + RLS, Storage, optional Realtime). **Gemini** and **Groq** are used **only on the server** from Route Handlers — keys never ship to the browser.

## End-to-end chat and RAG (one diagram)

```mermaid
flowchart LR
  subgraph client [Browser]
    ui[Chat UI]
  end
  subgraph api [Next POST api chat]
    z[Session plus Zod]
    lang[Bangla Banglish detect]
    tr[English query for RAG if bn]
    emb[Gemini embed 768d]
    rpc[match_rag_chunks_for_user]
    dbctx[Parallel profile vitals pregnancy planner appointments]
    asm[System plus user envelope]
    gen[Gemini chat then Groq fallback]
  end
  subgraph data [Supabase]
    pg[(Postgres rag plus health)]
  end
  subgraph models [Model APIs]
    ge[Gemini embedding REST]
    gc[Gemini generative chat]
    gq[Groq OpenAI chat]
  end
  ui --> z
  z --> lang
  lang --> tr
  tr --> emb
  emb --> ge
  emb --> rpc
  rpc --> pg
  z --> dbctx
  dbctx --> pg
  lang --> asm
  tr --> asm
  rpc --> asm
  dbctx --> asm
  asm --> gen
  gen --> gc
  gen --> gq
```

## Multilingual and voice (short)

- **Reply language:** Unicode Bangla script or **Banglish** Latin-token hints choose **Bangla vs English** system instructions.
- **Retrieval:** Bangla user text is **translated to English** (same Gemini→Groq helper) **only** to embed and search RAG; the model still answers in the user’s language.
- **Voice:** Request field `replyChannel: "voice"` adds **spoken-style** rules (no markdown, short sentences), slightly **higher temperature**, and TTS-friendly copy. Browser capture/playback lives under `src/lib/voice/*`.

## Model defaults (env overrides)

| Role | Typical | Env |
|------|---------|-----|
| Chat | `gemini-2.5-flash` | `GEMINI_CHAT_MODEL` |
| Chat fallback | `llama-3.1-8b-instant` on Groq | `GROQ_CHAT_MODEL` |
| Embeddings | `text-embedding-004` (768-D) | `GEMINI_EMBEDDING_MODEL` |

## Request path and security

1. **`proxy`** refreshes Supabase cookies and gates routes.
2. APIs use **`getSessionFromCookies`** and **`createSupabaseServerClient`**; Postgres **RLS** enforces row access.
3. Admin UI and `/api/admin/*` require **admin** role.

## Full reference

The canonical, diagram-heavy document is **`docs/ARCHITECTURE.md`** in the repository (chat sequence, failover ladder, RAG ingest vs query, community, realtime, deployment). Update both when you change AI or data paths.

```mermaid
flowchart TB
  subgraph client [Browser]
    ui[NextjsReact]
  end
  subgraph next [NextjsServer]
    api[ApiRoutes]
  end
  subgraph supa [Supabase]
    auth[Auth]
    db[(PostgresRLS)]
    rt[RealtimeOptional]
  end
  subgraph llm [ModelProviders]
    gemini[Gemini]
    groq[Groq]
  end
  ui --> api
  api --> auth
  api --> db
  ui --> rt
  api --> gemini
  api --> groq
```

## Security notes

- **Service role** keys stay server-only.
- Public `/docs` does **not** bypass API authentication.
