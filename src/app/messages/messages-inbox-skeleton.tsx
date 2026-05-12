import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MessagesInboxSkeleton() {
  return (
    <ul className="space-y-2 px-4 pt-4 pb-28">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Card className="flex gap-3 p-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-3 w-full max-w-[280px]" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
