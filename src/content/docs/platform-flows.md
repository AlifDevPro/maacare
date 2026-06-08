# User flows

This page walks through how people move through MaaCare from first visit to everyday use.

## First visit and registration

A new visitor lands on the marketing home page. From there they can open **Sign up** or **Log in**.

### Email registration

1. On the signup page, choose **Create account** with email, or use **Continue with Google**.
2. For email: enter name, email, password, and accept the terms, then tap **Continue**.
3. Complete the profile wizard: persona, role (for example parent, clinician, or student), optional health details, and preferences.
4. On the final step the account is created. If your project requires email confirmation, you will see a confirmation message before entering the app. Otherwise you go straight to the home dashboard at `/app`.

### Google sign-in

From signup or login, tap **Continue with Google**. After Google approves access, you return through the auth callback and land in the app (or the page you were sent to via a `next` link).

### AI registration (beta)

From signup, **Try AI registration** opens a chat that collects your details step by step. When the draft is complete, the app creates your account using the same backend auth as the standard flow.

## Daily use after sign-in

The home dashboard at `/app` shows pregnancy context when available, recent vitals, upcoming appointments, and shortcuts.

**Log symptoms:** open Symptoms, pick from grouped checklists, submit, and read the result page with low, medium, or high guidance tiers (educational only).

**Talk to the assistant:** open Chat, send a message, and receive a reply that can use your profile, recent logs, and the knowledge library. You can start a new conversation or continue an existing one.

**Record vitals:** open Vitals and save readings such as blood pressure, weight, or heart rate.

**Plan the day:** open Planner for hydration and daily planning tools.

**Postpartum:** open Postpartum for mood check-ins and recovery tips when that journey applies to you.

## Medical reports

Open Reports, upload a file or paste text, and wait for a plain-language summary. Each report is saved in your history. You can open a report again, reprocess it, or delete it. Summarized content can also inform chat when you ask about your own documents.

## Emergency and nearby care

**Emergency** (`/emergency`) is available without signing in. It shows hotlines and safety guidance.

**Facilities** uses your location (when you allow it) to list nearby hospitals, clinics, or pharmacies from the built-in Bangladesh facility catalog.

## Community and messages

Browse the community feed, create posts with text and optional images, comment on threads, and view member profiles. For private conversation, open Messages, search for a peer, and start a thread.

## Caregiver linking

In profile edit, you can invite a partner or caregiver to view parts of a pregnancy journey according to permissions you set. They must accept the invite. Linked viewers may see a care banner on the home screen when viewing shared data.

## Password recovery

From login, use **Forgot password**. Follow the email link to reset your password on the reset page. One-time email codes are also supported from the login screen.

## When something goes wrong

If you are not signed in and open a protected page, you are sent to login. Failed Google sign-in shows an error on the callback page with a link back to login. If the AI is unsure about language or meaning, it may ask a short clarifying question instead of guessing.
