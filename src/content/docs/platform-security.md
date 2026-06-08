# Security and privacy

MaaCare treats health-related data as sensitive. Access is enforced in the database and on the server, not only in the UI.

## Authentication

Users can sign in with **email and password**, **Google**, or **email one-time codes** from the login page.

Sessions use Supabase Auth with HTTP-only cookies. The proxy refreshes cookies on each request. Sign out clears the session through `/api/auth/logout`.

Password reset uses email links that land on `/auth/callback` and then the reset password page. Open redirects after login are blocked by an internal path allowlist.

## Authorization

Most tables use **row-level security** in Postgres. Users read and write only their own rows unless a policy explicitly allows more (for example community read access or care-link sharing).

**Admin** routes and `/api/admin/*` require `role = admin` on the profile. Moderators have separate community tools where implemented.

Users cannot change their own admin or moderator role through the public profile API.

## Data handling

Gemini, Groq, and Supabase service role keys exist only in server environment variables.

Signup AI transcripts can be redacted before sending text to the model. MCP tool inputs go through redaction helpers.

Community member pages expose only fields meant for public display. Pregnancy details on member cards are opt-in where the product supports it.

Medical reports belong to the uploading user. Report chunks for chat search respect the same ownership rules.

## Care relationships

Linking a caregiver requires an invite and acceptance. Permissions are stored as structured JSON (what the viewer may see). Viewers never get blanket access to the subject’s entire account.

## Push notifications

Device tokens are stored per user. The outbound push queue is not readable from the client; a cron job with a shared secret drains it server-side.

## Public pages

Marketing, login, signup, emergency information, and this documentation are reachable without signing in. Public docs do not grant access to private APIs.

## What you should configure in production

Use HTTPS everywhere. Set strong secrets for `CRON_SECRET` and Supabase service role. Restrict Supabase redirect URLs to your domains. Enable Google OAuth only for your production client IDs. Review RLS policies whenever you add new tables.

For persona-specific privacy rules, see `docs/persona-care-privacy.md` in the repository.
