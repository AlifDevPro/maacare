"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";

import { BookOpen, Camera, Loader2, Save, Shield, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DevProfile = {
  userId: string;
  cardDisplayName: string | null;
  jobTitle: string;
  bio: string;
  photoUrl: string | null;
  socialGithub: string | null;
  socialTwitter: string | null;
  socialLinkedin: string | null;
  socialWebsite: string | null;
  sortOrder: number;
  published: boolean;
  profileDisplayName: string;
  profileAvatarUrl: string | null;
  profileEmail: string;
};

const TEAM_CARD_MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

function LandingStylePosterPreview({
  name,
  jobTitle,
  bio,
  imageUrl,
  fallbackInitial,
}: {
  name: string;
  jobTitle: string;
  bio: string;
  imageUrl: string | null;
  fallbackInitial: string;
}) {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-border/50 bg-muted shadow-card">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-900/30 via-muted to-muted font-display text-5xl font-semibold text-primary/40">
          {fallbackInitial}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 min-w-0 p-4 pt-16 sm:p-5 sm:pt-20">
        <p className="font-display text-lg font-semibold leading-tight text-white drop-shadow-sm sm:text-xl">{name}</p>
        <p className="mt-1 text-sm text-white/85">{jobTitle}</p>
        {bio.trim() ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/75">{bio.trim()}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DeveloperPageClient() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<DevProfile | null>(null);

  const [cardDisplayName, setCardDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [cardPhotoUrl, setCardPhotoUrl] = useState<string | null>(null);
  const [cardPhotoUploading, setCardPhotoUploading] = useState(false);
  const cardPhotoInputRef = useRef<HTMLInputElement>(null);

  const [socialGithub, setSocialGithub] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/developer/me", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { profile?: DevProfile; message?: string };
      if (!res.ok) {
        throw new Error(j.message ?? "Could not load developer profile");
      }
      const p = j.profile;
      if (!p) throw new Error("Missing profile");
      setProfile(p);
      setCardDisplayName(p.cardDisplayName ?? "");
      setJobTitle(p.jobTitle ?? "");
      setBio(p.bio ?? "");
      setCardPhotoUrl(p.photoUrl);
      setSocialGithub(p.socialGithub ?? "");
      setSocialTwitter(p.socialTwitter ?? "");
      setSocialLinkedin(p.socialLinkedin ?? "");
      setSocialWebsite(p.socialWebsite ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchDeveloperPhoto(photoUrl: string | null) {
    const res = await fetch("/api/developer/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl }),
    });
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(j.message ?? "Update failed");
  }

  async function onCardPhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const uid = user?.id;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uid) return;

    const ext = extFromMime(file.type);
    if (!ext) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > TEAM_CARD_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }

    setCardPhotoUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${uid}/card.${ext}`;
      const { error: upErr } = await supabase.storage.from("developer_team").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        console.error(upErr);
        toast.error(upErr.message || "Could not upload photo.");
        return;
      }
      const { data: pub } = supabase.storage.from("developer_team").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      await patchDeveloperPhoto(publicUrl);
      setCardPhotoUrl(publicUrl);
      toast.success("Team card photo updated");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setCardPhotoUploading(false);
    }
  }

  async function removeCardPhoto() {
    setCardPhotoUploading(true);
    try {
      await patchDeveloperPhoto(null);
      setCardPhotoUrl(null);
      toast.success("Team card photo removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove photo.");
    } finally {
      setCardPhotoUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/developer/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardDisplayName: cardDisplayName.trim() || null,
          jobTitle: jobTitle.trim(),
          bio: bio.trim(),
          photoUrl: cardPhotoUrl,
          socialGithub: socialGithub.trim() || "",
          socialTwitter: socialTwitter.trim() || "",
          socialLinkedin: socialLinkedin.trim() || "",
          socialWebsite: socialWebsite.trim() || "",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Save failed");
      toast.success("Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const previewName = cardDisplayName.trim() || profile?.profileDisplayName || "Your name";
  const previewImg = cardPhotoUrl ?? profile?.profileAvatarUrl ?? null;
  const previewInitial = previewName.slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <AppHeader title="Developer" showBack backHref="/app" />

      <div className="min-w-0 space-y-6 px-4 pb-24 pt-4">
        <p className="min-w-0 text-sm text-muted-foreground">
          Update how you appear on the public <strong className="text-foreground">Meet the team</strong> section.
          Publishing and display order are controlled by an admin.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !profile ? (
          <Card className="min-w-0 rounded-2xl border-dashed">
            <CardHeader>
              <CardTitle>No developer profile</CardTitle>
              <CardDescription>Ask an admin to add your account to the team directory.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="min-w-0 rounded-2xl shadow-soft">
              <CardHeader className="min-w-0 space-y-2">
                <CardTitle className="font-display text-lg">Team card</CardTitle>
                <CardDescription className="break-words text-pretty">
                  <span className="block break-all">Signed in as {profile.profileEmail}.</span>{" "}
                  {profile.published ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Published on the site.</span>
                  ) : (
                    <span>Not published yet — an admin can enable this when ready.</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid min-w-0 gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="cdn">Display name (optional override)</Label>
                  <Input
                    id="cdn"
                    value={cardDisplayName}
                    onChange={(e) => setCardDisplayName(e.target.value)}
                    placeholder={profile.profileDisplayName}
                    className="min-w-0 rounded-xl"
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="jt">Title / role</Label>
                  <Input
                    id="jt"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Full-stack engineer"
                    className="min-w-0 rounded-xl"
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="bio">Short bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="One or two sentences for the landing page."
                    className="min-h-[100px] min-w-0 rounded-xl"
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label>Team card photo</Label>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, or GIF, up to 5MB. Shown on the landing page; if removed, your profile avatar is
                    used when available.
                  </p>
                  <input
                    ref={cardPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(ev) => void onCardPhotoFileChange(ev)}
                  />
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full shrink-0 rounded-xl sm:w-auto"
                      disabled={cardPhotoUploading}
                      onClick={() => cardPhotoInputRef.current?.click()}
                    >
                      {cardPhotoUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      Upload photo
                    </Button>
                    {cardPhotoUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl text-destructive sm:w-auto"
                        disabled={cardPhotoUploading}
                        onClick={() => void removeCardPhoto()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="gh">GitHub</Label>
                    <Input
                      id="gh"
                      value={socialGithub}
                      onChange={(e) => setSocialGithub(e.target.value)}
                      placeholder="https://github.com/…"
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="tw">X / Twitter</Label>
                    <Input
                      id="tw"
                      value={socialTwitter}
                      onChange={(e) => setSocialTwitter(e.target.value)}
                      placeholder="https://…"
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="li">LinkedIn</Label>
                    <Input
                      id="li"
                      value={socialLinkedin}
                      onChange={(e) => setSocialLinkedin(e.target.value)}
                      placeholder="https://…"
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="web">Website</Label>
                    <Input
                      id="web"
                      value={socialWebsite}
                      onChange={(e) => setSocialWebsite(e.target.value)}
                      placeholder="https://…"
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className={cn("w-full rounded-xl xl:w-auto")}
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save changes
                </Button>
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card className="min-w-0 overflow-hidden rounded-2xl border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-card to-card shadow-soft">
                <CardHeader className="min-w-0 pb-2">
                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-200">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Preview</span>
                  </div>
                  <CardTitle className="font-display text-lg">Landing card</CardTitle>
                  <CardDescription className="break-words">How you will appear in the public team grid.</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 px-4 pb-6 sm:px-6">
                  <LandingStylePosterPreview
                    name={previewName}
                    jobTitle={jobTitle.trim() || "Your title"}
                    bio={bio}
                    imageUrl={previewImg}
                    fallbackInitial={previewInitial}
                  />
                </CardContent>
              </Card>

              <Card className="min-w-0 rounded-2xl shadow-soft">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Team tools</CardTitle>
                  <CardDescription>Quick links for people building MaaCare.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-2">
                  <Button asChild variant="outline" className="justify-start rounded-xl">
                    <Link href="/docs" prefetch>
                      <BookOpen className="mr-2 h-4 w-4" /> Product docs
                    </Link>
                  </Button>
                  {user?.role === "admin" ? (
                    <Button asChild variant="outline" className="justify-start rounded-xl">
                      <Link href="/admin/developer-team" prefetch>
                        <Shield className="mr-2 h-4 w-4" /> Manage team directory
                      </Link>
                    </Button>
                  ) : null}
                  <p className="min-w-0 pt-2 text-xs text-muted-foreground">
                    More internal tools can be added here over time (feature flags, staging links, etc.).
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
