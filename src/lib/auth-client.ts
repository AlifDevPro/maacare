"use client";

import { useQuery } from "@tanstack/react-query";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { writeGuestLanguage } from "@/lib/i18n/guest-language";

export type Role = "user" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  language: "en" | "bn";
  avatarUrl?: string | null;
  /** Present when this account has a developer_team_profiles row. */
  isTeamDeveloper?: boolean;
};

/** Dispatched on login/logout/profile auth updates; RootProviders invalidates session query. */
export const AUTH_EVENT = "maacare:auth";

export const authSessionQueryKey = ["auth", "session"] as const;

export async function refreshSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

function authSessionQueryOptions() {
  return {
    queryKey: authSessionQueryKey,
    queryFn: refreshSession,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  };
}

export function useUser(): AuthUser | null {
  const { data } = useQuery(authSessionQueryOptions());
  return data ?? null;
}

/** Loading + user for gates (e.g. admin layout). Shared cache across navigations. */
export function useSession() {
  const query = useQuery(authSessionQueryOptions());
  return {
    user: query.data ?? null,
    loading: query.isPending,
  };
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
    message?: string;
  };

  if (!res.ok) {
    return { ok: false, error: data.message ?? data.error ?? "Login failed" };
  }

  if (!data.user) {
    return { ok: false, error: "Login failed" };
  }

  notifyAuth();
  return { ok: true, user: data.user };
}

export async function checkEmailRegistered(
  email: string,
): Promise<
  | { ok: true; registered: boolean }
  | { ok: true; unavailable: true }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/auth/email-registered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    registered?: boolean;
    unavailable?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.message ?? data.error ?? "Could not check email." };
  }
  if (data.unavailable) {
    return { ok: true, unavailable: true };
  }
  return { ok: true, registered: !!data.registered };
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
  /**
   * Must run in the browser (`createBrowserClient`) so PKCE for the confirmation email matches
   * `exchangeCodeForSession` on `/auth/callback`. Server-side `signUp` breaks that flow.
   */
  try {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin.replace(/\/+$/, "");
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/app")}&flow=signup`;

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: name.trim(),
          name: name.trim(),
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const dup =
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        msg.includes("duplicate") ||
        (error as { status?: number }).status === 422;
      if (dup) {
        return { ok: false, error: "This email is already registered. Try signing in instead." };
      }
      console.error("[auth/register] signUp:", error.message);
      return {
        ok: false,
        error: "We couldn't finish setting up your account. Please try again in a moment.",
      };
    }

    if (!data.user) {
      console.error("[auth/register] no user returned from signUp");
      return {
        ok: false,
        error: "We couldn't finish setting up your account. Please try again in a moment.",
      };
    }

    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: "This email is already registered. Try signing in instead." };
    }

    if (!data.session) {
      return {
        ok: true,
        needsEmailConfirmation: true,
        message:
          "We've sent you a confirmation email. Open the link to confirm your address — you'll be signed in when it completes.",
      };
    }

    const user = await refreshSession();
    if (!user) {
      return {
        ok: false,
        error: "Signed up but we couldn't load your profile. Try refreshing the page.",
      };
    }

    notifyAuth();
    return { ok: true, user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return { ok: false, error: message };
  }
}

/** “Log in with email” OTP for an existing user (`signInWithOtp`). Uses the “Magic Link” email template;
 * `postAuthPath` is used if they tap the link. Forgot password uses `resetPasswordForEmail` instead. */
async function signInEmailOtpForExistingUser(
  email: string,
  postAuthPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin.replace(/\/+$/, "");
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(postAuthPath)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const rateLimited =
        msg.includes("rate") || msg.includes("too many") || (error as { status?: number }).status === 429;
      if (rateLimited) {
        return { ok: false, error: "Too many attempts. Please wait a few minutes before trying again." };
      }
      const notFound =
        msg.includes("signups not allowed") ||
        msg.includes("user not found") ||
        (error as { code?: string }).code === "otp_disabled";
      if (notFound) {
        return {
          ok: false,
          error:
            "No account found for that email, or passwordless email sign-in is disabled in your Supabase project.",
        };
      }
      return {
        ok: false,
        error:
          error.message ||
          "Could not send the email. Check Supabase Auth email / SMTP settings and try again.",
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed.";
    return { ok: false, error: message };
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  /**
   * Supabase **recovery** flow (`resetPasswordForEmail`) — uses the “Reset password” email template,
   * not the “Magic Link” template. Run in the browser so PKCE lines up with `/auth/callback`.
   */
  try {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin.replace(/\/+$/, "");
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      const rateLimited =
        msg.includes("rate") || msg.includes("too many") || (error as { status?: number }).status === 429;
      if (rateLimited) {
        return {
          ok: false,
          error: "Too many reset attempts. Please wait a few minutes before trying again.",
        };
      }
      return {
        ok: false,
        error:
          error.message ||
          "We could not send the reset email. Check Supabase Auth email / SMTP settings and try again.",
      };
    }

    return {
      ok: true,
      message:
        "If an account exists for that email, check your inbox for a password reset message. Use the 8-digit one-time code, or the reset link in the same email.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send reset email.";
    return { ok: false, error: message };
  }
}

export async function sendLoginEmailOtp(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const inner = await signInEmailOtpForExistingUser(email, "/app");
  if (!inner.ok) {
    return { ok: false, error: inner.error };
  }
  return {
    ok: true,
    message: "Check your email — enter the 8-digit code, or use the sign-in link in the same message.",
  };
}

export async function verifyLoginEmailOtp(
  email: string,
  token: string,
  opts?: { flow?: "sign-in" | "password-reset" },
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  try {
    const supabase = createSupabaseBrowserClient();
    const otpType = opts?.flow === "password-reset" ? "recovery" : "email";
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token,
      type: otpType,
    });

    if (error || !data.user) {
      console.warn("[auth/verify-email-otp]", otpType, error?.message ?? "no user");
      return {
        ok: false,
        error: error?.message ?? "That code doesn't match or has expired. Request a new code.",
      };
    }

    const user = await refreshSession();
    if (!user) {
      return {
        ok: false,
        error: "You're signed in but we couldn't load your profile. Try refreshing the page.",
      };
    }

    notifyAuth();
    return { ok: true, user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return { ok: false, error: message };
  }
}

export async function updatePassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/auth/update-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    return { ok: false, error: data.message ?? data.error ?? "Could not update password." };
  }
  notifyAuth();
  return { ok: true };
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
  writeGuestLanguage(language);
  notifyAuth();
  return true;
}

/** @deprecated No local user without session; use useUser() */
export function getUser(): AuthUser | null {
  return null;
}
