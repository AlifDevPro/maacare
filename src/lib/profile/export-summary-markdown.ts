import type { ProfileBundle } from "@/app/profile/profile-types";
import type { VitalListItem } from "@/lib/app/user-lists-data";
import { formatIsoDate } from "@/lib/profile/computed";
import { format, parseISO } from "date-fns";

export type SymptomExportRow = {
  loggedAt: string;
  title: string | null;
  description: string | null;
  severity: number | null;
  symptomCodes: string[];
};

export type HealthDocumentExportRow = {
  title: string;
  uploadedAt: string;
  notes: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
};

export type ProfileExportInput = {
  bundle: ProfileBundle;
  vitals: VitalListItem[];
  symptoms: SymptomExportRow[];
  documents: HealthDocumentExportRow[];
  generatedAtIso: string;
};

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}

function oneLine(s: string | null | undefined, max = 2000): string {
  if (!s?.trim()) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function bullet(label: string, value: string | null | undefined): string {
  const v = value?.trim();
  if (!v) return "";
  return `- **${label}:** ${oneLine(v)}\n`;
}

function section(title: string, body: string): string {
  const b = body.trim();
  if (!b) return "";
  return `## ${title}\n\n${b}\n\n`;
}

export function buildProfileExportMarkdown(input: ProfileExportInput): string {
  const { bundle, vitals, symptoms, documents, generatedAtIso } = input;
  const p = bundle.profile;
  const h = bundle.health;
  const preg = bundle.pregnancy;
  const day = generatedAtIso.slice(0, 10);

  let out = "";
  out += `# MaaCare health summary\n\n`;
  out += `*Generated ${formatDateTime(generatedAtIso)}*\n\n`;
  out += `> This document is a readable summary of information stored in your MaaCare account. `;
  out += `Uploaded files are listed by title and date only; file contents are not included in this export.\n\n`;
  out += `---\n\n`;

  out += section(
    "Profile",
    p
      ? [
          bullet("Display name", p.display_name ?? ""),
          bullet("Email", p.email ?? ""),
          bullet("Phone", p.phone ?? ""),
          bullet("Language", p.language === "bn" ? "বাংলা" : p.language ?? ""),
          bullet("Date of birth", p.date_of_birth ? formatIsoDate(p.date_of_birth) : ""),
          bullet("Sex", p.sex ?? ""),
          bullet("Timezone", p.timezone ?? ""),
          bullet("Profession (self-reported)", p.profession ?? ""),
        ].join("")
      : "_No profile details on file._",
  );

  if (preg) {
    out += section(
      "Pregnancy & postpartum",
      [
        bullet("Status", preg.pregnancy_status?.replace(/_/g, " ") ?? ""),
        bullet("Last menstrual period (LMP)", preg.lmp_date ? formatIsoDate(preg.lmp_date) : ""),
        bullet("Estimated due date (EDD)", preg.edd_date ? formatIsoDate(preg.edd_date) : ""),
        bullet("Gestational age (weeks, recorded)", preg.gestational_age_weeks != null ? String(preg.gestational_age_weeks) : ""),
        bullet("Gravida", preg.gravida != null ? String(preg.gravida) : ""),
        bullet("Para", preg.para != null ? String(preg.para) : ""),
        bullet("Baby birth date", preg.baby_birth_date ? formatIsoDate(preg.baby_birth_date) : ""),
        bundle.computed.gestationalWeek != null
          ? bullet("Computed gestational week (app)", String(bundle.computed.gestationalWeek))
          : "",
        bundle.computed.displayEdd
          ? bullet("Computed EDD shown in app", formatIsoDate(bundle.computed.displayEdd))
          : "",
      ].join(""),
    );
  }

  if (h) {
    out += section(
      "Health profile",
      [
        bullet("Blood type", h.blood_type ?? ""),
        bullet("Height (cm)", h.height_cm != null ? String(h.height_cm) : ""),
        bullet("Weight (kg)", h.weight_kg != null ? String(h.weight_kg) : ""),
        bullet("Emergency contact name", h.emergency_contact_name ?? ""),
        bullet("Emergency contact phone", h.emergency_contact_phone ?? ""),
        bullet("Relation", h.emergency_contact_relation ?? ""),
        bullet("Primary care provider", h.primary_care_provider ?? ""),
        bullet("Insurance provider", h.insurance_provider ?? ""),
        bullet("Insurance member ID", h.insurance_member_id ?? ""),
        h.notes?.trim() ? bullet("Health notes", h.notes) : "",
      ].join(""),
    );
  }

  const allergyLines =
    bundle.allergies.length > 0
      ? bundle.allergies.map((a) => `- ${oneLine(a)}`).join("\n")
      : "_None recorded._";
  out += section("Allergies", allergyLines);

  const condLines =
    bundle.conditions.length > 0
      ? bundle.conditions.map((c) => `- ${oneLine(c)}`).join("\n")
      : "_None recorded._";
  out += section("Medical conditions", condLines);

  out += section(
    "Preferences & visibility",
    p
      ? [
          typeof p.notify_daily_reminders === "boolean"
            ? bullet("Daily reminders", p.notify_daily_reminders ? "On" : "Off")
            : "",
          typeof p.notify_community_activity === "boolean"
            ? bullet("Community activity notifications", p.notify_community_activity ? "On" : "Off")
            : "",
          typeof p.community_show_extended_profile === "boolean"
            ? bullet("Show extended profile in community", p.community_show_extended_profile ? "Yes" : "No")
            : "",
        ].join("")
      : "_Not applicable (no profile row)._",
  );

  if (vitals.length > 0) {
    const lines = vitals.map((v) => {
      const parts: string[] = [formatDateTime(v.recordedAt)];
      if (v.systolicBp != null || v.diastolicBp != null) {
        parts.push(`BP ${v.systolicBp ?? "—"}/${v.diastolicBp ?? "—"}`);
      }
      if (v.heartRateBpm != null) parts.push(`HR ${v.heartRateBpm} bpm`);
      if (v.temperatureC != null) parts.push(`${v.temperatureC} °C`);
      if (v.spo2Pct != null) parts.push(`SpO₂ ${v.spo2Pct}%`);
      if (v.weightKg != null) parts.push(`${v.weightKg} kg`);
      if (v.glucoseMgDl != null) parts.push(`Glucose ${v.glucoseMgDl} mg/dL`);
      if (v.notes?.trim()) parts.push(`Note: ${oneLine(v.notes, 500)}`);
      return `- ${parts.join(" · ")}`;
    });
    out += section("Recent vitals", lines.join("\n"));
  } else {
    out += section("Recent vitals", "_None recorded._");
  }

  if (symptoms.length > 0) {
    const lines = symptoms.map((s) => {
      const head = `**${formatDateTime(s.loggedAt)}**`;
      const title = s.title ? ` — ${oneLine(s.title, 200)}` : "";
      const sev = s.severity != null ? ` (severity ${s.severity}/10)` : "";
      const codes =
        s.symptomCodes.length > 0 ? `\n  - Codes: ${s.symptomCodes.map((c) => oneLine(c, 120)).join(", ")}` : "";
      const desc = s.description?.trim() ? `\n  - ${oneLine(s.description, 1500)}` : "";
      return `- ${head}${title}${sev}${codes}${desc}`;
    });
    out += section("Symptom check-ins", lines.join("\n"));
  } else {
    out += section("Symptom check-ins", "_None recorded._");
  }

  if (documents.length > 0) {
    const lines = documents.map((d) => {
      const size =
        d.fileSizeBytes != null && d.fileSizeBytes > 0
          ? ` · ${(d.fileSizeBytes / 1024).toFixed(1)} KB`
          : "";
      const mime = d.mimeType ? ` · ${oneLine(d.mimeType, 80)}` : "";
      const note = d.notes?.trim() ? ` — ${oneLine(d.notes, 400)}` : "";
      return `- **${oneLine(d.title, 200)}** (${formatDateTime(d.uploadedAt)}${size}${mime})${note}`;
    });
    out += section("Uploaded health documents (metadata)", lines.join("\n"));
  } else {
    out += section("Uploaded health documents (metadata)", "_None recorded._");
  }

  out += `---\n\n*End of MaaCare export · ${day}*\n`;
  return out;
}
