import type { HomeUiVisibility, UserAppContext } from "@/lib/app/user-app-context";

export type UpcomingAppointment = {
  id: string;
  title: string;
  scheduled_at: string;
  provider_name: string | null;
  location: string | null;
  appointment_type: string | null;
};

export type LatestVitals = {
  recorded_at: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate_bpm: number | null;
  weight_kg: number | null;
  temperature_c: number | null;
  glucose_mg_dl: number | null;
  spo2_pct: number | null;
};

export type LatestSymptom = {
  id: string;
  logged_at: string;
  title: string | null;
  severity: number | null;
};

export type JourneyStage = "planning" | "pregnant" | "postpartum";

export type HomeCareBanner = {
  viewingSubjectUserId: string | null;
  viewingSubjectDisplayName: string | null;
};

export type HomeData = {
  profile: { displayName: string };
  pregnancy: {
    status: string | null;
    gestationalWeek: number | null;
    displayEdd: string | null;
    babyBirthDate: string | null;
    postpartumWeek: number | null;
  };
  vitals: LatestVitals | null;
  latestSymptom: LatestSymptom | null;
  upcomingAppointment: UpcomingAppointment | null;
  upcomingAppointmentsCount: number;
  unreadNotificationsCount: number;
  serverTime: string;
  ui: HomeUiVisibility;
  care: HomeCareBanner;
  appContext: UserAppContext;
};
