"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { ProfileBundle } from "@/app/profile/profile-types";

export const profileBundleQueryKey = ["profile", "bundle"] as const;

const STALE_MS = 5 * 60_000;
const GC_MS = 30 * 60_000;

export async function fetchProfileBundle(): Promise<ProfileBundle> {
  const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load profile");
  }
  return res.json() as Promise<ProfileBundle>;
}

export function prefetchProfileBundle(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: profileBundleQueryKey,
    queryFn: fetchProfileBundle,
    staleTime: STALE_MS,
  });
}

export function setProfileBundleCache(queryClient: QueryClient, bundle: ProfileBundle) {
  queryClient.setQueryData(profileBundleQueryKey, bundle);
}

/** Stale-while-revalidate profile data — instant when cached after first load. */
export function useProfileBundle(initialBundle?: ProfileBundle) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: profileBundleQueryKey,
    queryFn: fetchProfileBundle,
    initialData: () =>
      queryClient.getQueryData<ProfileBundle>(profileBundleQueryKey) ?? initialBundle,
    placeholderData: (prev) => prev ?? queryClient.getQueryData<ProfileBundle>(profileBundleQueryKey),
    staleTime: STALE_MS,
    gcTime: GC_MS,
    refetchOnWindowFocus: false,
  });
}

export function invalidateProfileBundle(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: profileBundleQueryKey });
}
