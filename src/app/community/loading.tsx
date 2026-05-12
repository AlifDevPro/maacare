import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CommunityLoading() {
  return (
    <AppShell>
      <AppHeader title="Community" showNotifications />
      <div className="space-y-3 px-4 pt-4 pb-28">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-9 w-full max-w-[14rem] rounded-xl" />
          <Skeleton className="h-9 w-10 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="overflow-hidden p-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-[90%] rounded-md" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
