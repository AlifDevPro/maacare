import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { MemberProfileSkeleton } from "./member-profile-skeleton";

export default function MemberProfileLoading() {
  return (
    <AppShell>
      <AppHeader title="Member" showBack backHref="/community" showNotifications />
      <MemberProfileSkeleton />
    </AppShell>
  );
}
