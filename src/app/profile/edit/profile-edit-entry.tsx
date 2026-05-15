"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ProfileEditSkeleton } from "@/app/profile/edit/profile-edit-skeleton";
import { useProfileBundle } from "@/lib/app/profile-bundle-query";
import { useSession } from "@/lib/auth-client";

const ProfileEditClient = dynamic(
  () => import("@/app/profile/edit/profile-edit-client").then((m) => ({ default: m.ProfileEditClient })),
  { loading: () => <ProfileEditSkeleton /> },
);

/** Client entry — route paints immediately; form loads from cache or API. */
export function ProfileEditPageEntry() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { data: bundle, isPending: bundlePending } = useProfileBundle();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.replace("/login?next=/profile/edit");
    }
  }, [sessionLoading, user, router]);

  if (sessionLoading || !user) {
    return <ProfileEditSkeleton />;
  }

  if (!bundle && bundlePending) {
    return <ProfileEditSkeleton />;
  }

  if (!bundle) {
    return <ProfileEditSkeleton />;
  }

  return <ProfileEditClient initialBundle={bundle} session={user} />;
}
