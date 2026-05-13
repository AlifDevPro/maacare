/** Shared with server routes and client UI — do not import from `"use client"` modules into API handlers. */
export const PROFESSION_VALUES = ["parent_caregiver", "clinician", "other"] as const;
export type ProfessionValue = (typeof PROFESSION_VALUES)[number];
