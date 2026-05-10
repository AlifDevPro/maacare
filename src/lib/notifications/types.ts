export type NotificationDTO = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
  actorId: string | null;
  actorDisplayName: string | null;
};
