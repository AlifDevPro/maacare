import { AppHeader } from "@/components/app/AppHeader";
import { AppShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

type Props =
  | { variant: "home" }
  | { variant: "page"; title: string; showBack?: boolean; showNotifications?: boolean };

export function AppRouteLoadingShell(props: Props) {
  const header =
    props.variant === "home" ? (
      <AppHeader brand showNotifications />
    ) : (
      <AppHeader
        title={props.title}
        showBack={props.showBack ?? true}
        showNotifications={props.showNotifications}
      />
    );

  return (
    <AppShell>
      {header}
      <div className="space-y-4 px-4 pt-4 pb-28">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </AppShell>
  );
}
