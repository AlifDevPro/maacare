# Bangla copy guide (MaaCare UI)

This project uses **i18next** with bundled JSON under `src/messages/en/` and `src/messages/bn/`. English is the **fallback** for missing Bangla keys.

## Authoring principles

1. **Concept-first, not calque** — Prefer clear clinical/UX meaning in natural Bangla over word-for-word English. If a literal translation reads awkwardly, rewrite for the intent (reassurance, urgency, next step).
2. **Stable keys** — Keys stay in English (`snake_case`). Only **values** in `bn/*.json` are Bangla (except proper nouns, product name “MaaCare”, clinical abbreviations where standard).
3. **Consistency** — Reuse the same Bangla term for the same concept app-wide (e.g. pregnancy week, vitals, emergency). When in doubt, align with the glossary below.
4. **Short UI strings** — Buttons and nav labels stay short; body copy can be slightly longer but avoid paragraph-long labels.
5. **Numbers and units** — Keep digits and SI/medical units where they aid clarity (`bpm`, `°C`, `SpO₂`). You may use Bengali numerals in Bangla copy where the design calls for it (e.g. `/৪০` on home); stay consistent per surface.
6. **No bulk machine fill** — Do not auto-generate entire `bn` namespaces without human review, especially for clinical flows.

## Glossary (examples — extend as you migrate)

| Concept | EN (reference) | BN (preferred direction) |
|--------|------------------|---------------------------|
| Vitals | Vitals | জীবনসূচক |
| Symptoms | Symptoms | লক্ষণ |
| Emergency | Emergency | জরুরি |
| Planner / daily plan | Planner / daily care plan | পরিকল্পনা / দৈনিক যত্নের পরিকল্পনা |
| Postpartum | Postpartum | প্রসবোত্তর |
| Appointment | Appointment | অ্যাপয়েন্টমেন্ট |
| Profile | Profile | প্রোফাইল |
| Community | Community | সম্প্রদায় |
| Messages (DM) | Messages | বার্তা |

## QA checklist (Phase 1+)

- [ ] Profile language **বাংলা**: shell (nav, header, profile menu), auth, home show Bangla with no unintended English (except untranslated keys).
- [ ] `document.documentElement.lang` is **`bn`** when Bangla is active (set by `I18nProvider` / `setHtmlLang`).
- [ ] Language switch updates UI without full reload; session reflects `profiles.language`.
- [ ] Symptom chips still save correctly: stored codes are **i18n keys** (`sym_fever`, …), not display strings.

## File map

- **Bootstrap:** `src/lib/i18n/i18n.ts`
- **Provider:** `src/components/providers/i18n-provider.tsx`
- **SSR hint:** `src/components/providers/initial-language-from-server.tsx` — wrap RSC output when `session.language` is already known.
- **Namespaces:** `common`, `nav`, `shell`, `home`, `auth`, `health`, `community`, `messages`, `admin`, `marketing`
