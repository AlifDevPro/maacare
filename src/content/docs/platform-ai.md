# AI capabilities

MaaCare uses AI on the server to power chat, report simplification, signup assistance, and a few supporting features such as postpartum insights and planner food suggestions. The browser never receives API keys.

## Where AI appears

**Chat** (`/chat`): main conversational assistant with optional voice-style replies.

**Signup AI** (`/api/signup/ai-turn`): anonymous, rate-limited chat during registration.

**Report simplifier** (`/reports`): turns uploads or pasted text into plain-language summaries.

**Postpartum insights**, **planner food**, and **symptom log insights**: smaller generated summaries tied to those screens.

## Languages

The app supports English and Bangla in the UI. For chat, a multilingual pipeline detects language, can lock the conversation language so short replies like “ok” do not switch locale, and translates queries to English internally for search while answering in the user’s language.

Signup onboarding uses a separate language lock so names and casual text do not flip the conversation unexpectedly.

## How chat uses knowledge

**Global library:** admins ingest documents into the knowledge base. Text is split into chunks, embedded with Gemini, and stored in Postgres. Chat searches by meaning, not exact keywords.

**Your reports:** when you upload medical documents, chunks are stored for your account only. Chat can pull from them when you ask about your own results.

**Your profile and logs:** pregnancy details, vitals, symptoms, medications, and similar fields are added to the prompt as personal context when relevant.

**Nearby facilities:** if you share location and ask about nearby care, the app queries the Bangladesh facility catalog.

## Intent and safety

Before answering, the server classifies what you are asking (greeting, symptom guidance, report question, nearby facilities, and others). That choice controls whether to search the library, how long the answer should be, and whether to ask for clarification.

System prompts include medical safety rules: no diagnosis, encourage professional care when appropriate, and plain language. A quality step can regenerate once if the model returns empty text, echoes your message, or uses unwanted “AI assistant” phrasing.

Optional **MCP tools** (when enabled with `MCP_ENABLED=1`) can read context, search knowledge, create reminders with your consent, or log escalation events. Signup AI does not run write tools.

## Providers and failover

Primary chat and embeddings use **Google Gemini**. If Gemini fails or returns empty text, **Groq** is tried with the same prompt structure. Translation and some vision tasks also use Groq.

If neither provider is configured, AI features return an error rather than a fake answer.

## Limits you should know

AI output is educational, not clinical. Answer quality depends on the knowledge library and your profile completeness. Very low confidence in translation may trigger a clarifying question instead of a full answer. Live Google Maps search is not wired up; facility lookup uses the imported catalog only.

For technical detail on detection and retrieval, see [Algorithms](/docs/algorithms).
