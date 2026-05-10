export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  language: "en" | "bn";
};
