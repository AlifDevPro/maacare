"use client";

import { Bell, BellOff, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { useWebPushControls } from "@/components/app/web-push-manager";
import { Switch } from "@/components/ui/switch";

function PushToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof Bell;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function WebPushPreferences({
  pushEnabled,
  dmEnabled,
  onPushEnabledChange,
  onDmEnabledChange,
}: {
  pushEnabled: boolean;
  dmEnabled: boolean;
  onPushEnabledChange: (v: boolean) => Promise<void>;
  onDmEnabledChange: (v: boolean) => Promise<void>;
}) {
  const push = useWebPushControls();

  if (!push.supported) {
    return (
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Push notifications are not supported on this device. Use Chrome, Edge, Safari, or install the app on Android/iOS.
      </p>
    );
  }

  if (!push.clientReady) {
    return (
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Push notifications are not configured yet. Add Firebase web keys (API key, project ID, VAPID) to
        the server environment, then reload.
      </p>
    );
  }

  const masterOn = pushEnabled && push.subscribed;

  return (
    <>
      {!push.serverReady ? (
        <p className="border-b border-border/60 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          Device can be registered, but the server cannot send pushes until{" "}
          <code className="text-[0.7rem]">FIREBASE_SERVICE_ACCOUNT_JSON</code> is set.
        </p>
      ) : null}
      <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {push.busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : masterOn ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Device notifications</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {push.permission === "denied"
              ? "Blocked in browser settings — allow notifications for this site."
              : "Firebase push for messages, replies, and updates — works on web and mobile when configured."}
          </p>
        </div>
        <Switch
          checked={masterOn}
          disabled={push.busy || push.permission === "denied"}
          onCheckedChange={async (on) => {
            if (on) {
              const result = await push.enable();
              if (result?.ok) {
                await onPushEnabledChange(true);
                toast.success("Notifications enabled");
              } else if (result && !result.ok) {
                toast.error(
                  result.reason === "denied"
                    ? "Allow notifications in your browser to continue"
                    : "Could not enable notifications on this device",
                );
              } else {
                toast.error("Allow notifications in your browser to continue");
              }
            } else {
              await push.disable();
              await onPushEnabledChange(false);
              toast.success("Notifications turned off");
            }
            await push.refresh();
          }}
        />
      </div>

      <PushToggleRow
        icon={MessageSquare}
        label="Message notifications"
        description="Push when someone sends you a direct message."
        checked={dmEnabled}
        disabled={!masterOn || push.busy}
        onCheckedChange={async (v) => {
          await onDmEnabledChange(v);
          toast.success(v ? "Message notifications on" : "Message notifications off");
        }}
      />
    </>
  );
}
