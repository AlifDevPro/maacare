"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ProfileMenuState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ProfileMenuContext = createContext<ProfileMenuState | null>(null);

export function ProfileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <ProfileMenuContext.Provider value={value}>{children}</ProfileMenuContext.Provider>;
}

export function useProfileMenuOpen(): ProfileMenuState {
  const ctx = useContext(ProfileMenuContext);
  if (!ctx) {
    return { open: false, setOpen: () => {} };
  }
  return ctx;
}
