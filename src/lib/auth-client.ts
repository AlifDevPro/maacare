"use client";

import { useEffect, useState } from "react";

export type Role = "user" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  language: "en" | "bn";
};

const AUTH_EVENT = "maacare:auth";

export async function refreshSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

export function useUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((u) => {
      if (!cancelled) setUser(u);
    });
    const onAuth = () => {
      void refreshSession().then(setUser);
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, onAuth);
    };
  }, []);

  return user;
}

/** Loading + user for gates (e.g. admin layout). */
export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });
    const onAuth = () => {
      void refreshSession().then((u) => {
        if (!cancelled) setUser(u);
      });
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, onAuth);
    };
  }, []);

  return { user, loading };
}

function notifyAuth() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    user?: AuthUser;
    error?: string;
  };

  if (!res.ok) {
    return { ok: false, error: data.error ?? "Login failed" };
  }

  if (!data.user) {
    return { ok: false, error: "Login failed" };
  }

  notifyAuth();
  return { ok: true, user: data.user };
}

export async function registerAccount(
  name: string,
  email: string,
  password: string,
): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; error: string }
  | { ok: true; needsEmailConfirmation: true; message: string }
> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    user?: AuthUser;
    error?: string;
    needsEmailConfirmation?: boolean;
    message?: string;
  };

  if (!res.ok) {
    return { ok: false, error: data.error ?? "Registration failed" };
  }

  if (data.needsEmailConfirmation) {
    return {
      ok: true,
      needsEmailConfirmation: true,
      message: data.message ?? "Check your email to confirm your account.",
    };
  }

  if (!data.user) {
    return { ok: false, error: "Registration failed" };
  }

  notifyAuth();
  return { ok: true, user: data.user };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  notifyAuth();
}

export async function updateUserLanguage(language: "en" | "bn"): Promise<boolean> {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ language }),
  });
  if (!res.ok) return false;
  notifyAuth();
  return true;
}

/** @deprecated No local user without session; use useUser() */
export function getUser(): AuthUser | null {
  return null;
}
