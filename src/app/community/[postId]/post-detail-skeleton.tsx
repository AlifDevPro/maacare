import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PostDetailSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-28">
      <Card className="overflow-hidden p-4">
        <div className="flex gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-[92%] max-w-lg" />
            <Skeleton className="h-4 w-[70%] max-w-sm" />
          </div>
        </div>
        <div className="mt-4 flex gap-3 border-t border-border/60 pt-3">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </Card>
      <Card className="p-4">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="space-y-3">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[88%]" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
