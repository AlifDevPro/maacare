export type PushChannel = "community" | "dm" | "system";

export type WebPushPayload = {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string | null;
};

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};
