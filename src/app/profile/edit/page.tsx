import { ProfileEditPageEntry } from "@/app/profile/edit/profile-edit-entry";

/** Client-rendered so navigation to /profile/edit is instant (no server data wait). */
export default function ProfileEditPage() {
  return <ProfileEditPageEntry />;
}
