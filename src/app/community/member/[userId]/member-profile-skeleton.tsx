import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MemberProfileSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-28">
      <Card className="p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-48" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </Card>
      <div className="w-full space-y-3">
        <div className="grid grid-cols-2 gap-0 border-b border-border pb-2">
          <Skeleton className="mx-auto h-4 w-14" />
          <Skeleton className="mx-auto h-4 w-20" />
        </div>
        <Card className="p-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1.5 h-3 w-[90%]" />
        </Card>
        <Card className="p-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1.5 h-3 w-[75%]" />
        </Card>
      </div>
    </div>
  );
}
