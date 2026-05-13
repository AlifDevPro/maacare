import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors admin user detail layout: header, auth, profile, activity cards. */
export function AdminUserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-[7.5rem] rounded-md" />

      <div className="space-y-2">
        <Skeleton className="h-8 w-[min(100%,18rem)] max-w-full" />
        <Skeleton className="h-4 w-[min(100%,22rem)] max-w-full" />
      </div>

      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-14" />
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-6 w-[min(100%,14rem)]" />
          <Skeleton className="h-6 w-[min(100%,18rem)]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </Card>

      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        </div>
      </Card>
    </div>
  );
}
