import type { Metadata } from "next";

import EmergencyClient from "./emergency-client";

export const metadata: Metadata = {
  title: "Emergency help · MaaCare",
  description: "Nearby clinics, hospitals, and pharmacies for maternity and urgent care.",
};

export default function EmergencyPage() {
  return <EmergencyClient />;
}
