import { Skeleton } from "@/components/ui/skeleton";

export function DmThreadSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-3 pb-36">
      <div className="flex justify-start">
        <Skeleton className="h-16 w-[72%] max-w-sm rounded-2xl rounded-tl-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-[55%] max-w-xs rounded-2xl rounded-tr-md" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-[80%] max-w-sm rounded-2xl rounded-tl-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-14 w-[48%] max-w-xs rounded-2xl rounded-tr-md" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-11 w-[65%] max-w-sm rounded-2xl rounded-tl-md" />
      </div>
    </div>
  );
}
