# Persona matrix and care-link privacy

This document defines product rules for [`buildUserAppContext`](../src/lib/app/user-app-context.ts) and [`care_relationships`](../supabase/migrations/20260521120000_persona_and_care_relationships.sql) (RLS). It is the Phase 0 reference for gating and privacy reviews.

## Primary use cases (`profiles.primary_use_case`)

| Value | Who | Home pregnancy hero | Own LMP/EDD on profile | Linked pregnancy (active care) |
| --- | --- | --- | --- | --- |
| `self_maternal` (default when null) | Person tracking their own pregnancy journey | Yes, from own `pregnancy_profiles` | Yes, per journey status | N/A |
| `partner_support` | Partner / family supporting someone pregnant | Yes only when an **active** care link exists and `read_pregnancy` is allowed; otherwise show connect CTA | Hidden (use link, not a second fake pregnancy) | Required for pregnancy timeline |
| `student_research` | Student or researcher | If their own journey status is pregnant/planning/postpartum; else wellness-focused hero | Same rules as journey status | Optional |
| `clinician` | Health professional using app personally | Same as student path for own data | Same as journey status | Optional |
| `other_caregiver` | Other caregiver | Treated like `self_maternal` for pregnancy fields unless product narrows later | Per journey status | Optional |

## Pregnancy status vocabulary (Phase 4 decision)

We **do not** add a new `pregnancy_status` enum value. Partners use `pregnancy_status = not_applicable` plus `primary_use_case = partner_support`. All partner-specific UI derives from `primary_use_case` and care-link state.

## Care relationship permissions (`care_relationships.permissions` JSON)

Default shape:

```json
{
  "read_pregnancy": true,
  "read_vitals": true,
  "read_symptoms": true
}
```

| Permission | Meaning | Data |
| --- | --- | --- |
| `read_pregnancy` | Viewer may read subject’s pregnancy row | `pregnancy_profiles` for `subject_user_id` |
| `read_vitals` | Viewer may read subject’s latest vitals | `vital_signs` for `subject_user_id` |
| `read_symptoms` | Viewer may read subject’s latest symptoms | `symptom_logs` for `subject_user_id` |

Mutations (`UPDATE`/`INSERT`/`DELETE`) on subject-owned clinical rows remain **subject-only** via existing RLS. Viewers do not gain write access through care links in v1.

## RLS expectations

- **Own data**: unchanged; users always read/write their own rows where policies already exist.
- **Care viewer**: additional **SELECT** policies allow the viewer to read subject rows only when `care_relationships.status = active` and the corresponding permission is true (or omitted, treated as true for backwards compatibility).
- **Abuse**: viewers can create pending requests to arbitrary `subject_user_id`; subjects must **accept** before access grants. Rate-limit invite/request APIs in application layer when needed.

## Invite / accept model

- `invited_by_user_id` records who created the row.
- **Accept** must be performed by the **other** party (not `invited_by_user_id`), while `status = pending`.
- Either party may **revoke** an active or pending relationship (implementation sets `status = revoked`).

## Chat and planner

When `primary_use_case = partner_support` and an active care link grants `read_pregnancy`, pregnancy context for AI should use the **subject’s** `pregnancy_profiles` row (same effective user id as Home). Vitals/symptoms in chat follow `read_vitals` / `read_symptoms` the same way as Home.
