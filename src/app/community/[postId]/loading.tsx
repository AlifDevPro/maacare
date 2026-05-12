import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { PostDetailSkeleton } from "./post-detail-skeleton";

export default function PostDetailLoading() {
  return (
    <AppShell>
      <AppHeader title="Post" showBack showNotifications />
      <PostDetailSkeleton />
    </AppShell>
  );
}
