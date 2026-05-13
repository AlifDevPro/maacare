"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";

import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { BookOpen, ImagePlus, Loader2, Save, Shield, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  showOnTeamSection: boolean;
  profileDisplayName: string;
  profileAvatarUrl: string | null;
  profileEmail: string;
};

const TEAM_CARD_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Public bucket created by migration `20260519140000_storage_developer_team.sql` — required for team card uploads. */
const DEVELOPER_TEAM_BUCKET = "developer_team";
/** Profile avatars (`20260515100000_storage_avatars_bucket.sql`). */
const AVATARS_BUCKET = "avatars";

function storageObjectSuffix(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatStorageUploadError(err: { message?: string } | null): string {
  const raw = err?.message ?? "";
  const lower = raw.toLowerCase();
  const bucketHint =
    'Storage bucket "' +
    DEVELOPER_TEAM_BUCKET +
    '" is missing on this project. Apply Supabase migrations or create that bucket under Dashboard → Storage.';
  if (
    (lower.includes("bucket") && (lower.includes("not found") || lower.includes("does not exist"))) ||
    lower.includes("no such bucket")
  ) {
    return bucketHint;
  }
  return raw || "Could not upload photo.";
}

/** Same storage path keeps the same URL after upsert; browsers cache by URL — bump rev so `<img>` refetches. */
function withStorageCacheBust(url: string, rev: number): string {
  if (rev <= 0) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("cb", String(rev));
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}cb=${rev}`;
  }
}

function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    // Blob/data URLs must not use crossOrigin — it breaks loading/canvas export in several browsers.
    if (url.startsWith("http://") || url.startsWith("https://")) {
      image.crossOrigin = "anonymous";
    }
    image.src = url;
  });
}

async function getCroppedImageBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageElement(imageSrc);
  if (image.decode) {
    try {
      await image.decode();
    } catch {
      /* decode is optional */
    }
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");
  const w = Math.max(1, Math.round(pixelCrop.width));
  const h = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

/** Matches landing team cards (portrait); width / height of crop rect. */
const CROP_ASPECT = 3 / 4;

/** Center crop in image pixel space when react-easy-crop has not reported pixels yet. */
function centerCropAreaPixels(naturalWidth: number, naturalHeight: number): Area {
  const nw = naturalWidth;
  const nh = naturalHeight;
  const imgAspect = nw / nh;
  if (imgAspect >= CROP_ASPECT) {
    const cropH = nh;
    const cropW = nh * CROP_ASPECT;
    return { x: (nw - cropW) / 2, y: 0, width: cropW, height: cropH };
  }
  const cropW = nw;
  const cropH = nw / CROP_ASPECT;
  return { x: 0, y: (nh - cropH) / 2, width: cropW, height: cropH };
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
  /** Increment after each successful team photo upload so the UI bypasses browser cache for the same public URL. */
  const [teamPhotoDisplayRev, setTeamPhotoDisplayRev] = useState(0);
  /** Same for account/profile avatar (`profiles.avatar_url`). */
  const [profileAvatarDisplayRev, setProfileAvatarDisplayRev] = useState(0);
  const [cardPhotoUploading, setCardPhotoUploading] = useState(false);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const cardPhotoInputRef = useRef<HTMLInputElement>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const [socialGithub, setSocialGithub] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");
  const [showOnTeamSection, setShowOnTeamSection] = useState(true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [photoDragActive, setPhotoDragActive] = useState(false);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const croppedAreaPixelsRef = useRef<Area | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/developer/me", { credentials: "include", cache: "no-store" });
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
      setShowOnTeamSection(p.showOnTeamSection ?? true);
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

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function endCropSession() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);
    setCroppedAreaPixels(null);
    croppedAreaPixelsRef.current = null;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  function openCropWithFile(file: File) {
    const ext = extFromMime(file.type);
    if (!ext) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > TEAM_CARD_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    croppedAreaPixelsRef.current = null;
    setCropOpen(true);
  }

  async function confirmCrop() {
    if (!cropSrc) {
      toast.error("No image to crop.");
      return;
    }
    let area = croppedAreaPixelsRef.current ?? croppedAreaPixels;
    if (!area) {
      try {
        const img = await createImageElement(cropSrc);
        area = centerCropAreaPixels(img.naturalWidth, img.naturalHeight);
      } catch {
        toast.error("Could not read image for crop.");
        return;
      }
    }
    try {
      const blob = await getCroppedImageBlob(cropSrc, area);
      if (blob.size > TEAM_CARD_MAX_BYTES) {
        toast.error("Cropped image is still too large. Try a smaller source or lower zoom.");
        return;
      }
      const file = new File([blob], "card.jpg", { type: "image/jpeg" });
      endCropSession();
      await uploadCardPhotoFile(file);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not crop image.");
    }
  }

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

  async function uploadCardPhotoFile(file: File) {
    const uid = user?.id;
    if (!uid) return;

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
      const path = `${uid}/team-card-${storageObjectSuffix()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(DEVELOPER_TEAM_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        console.error(upErr);
        toast.error(formatStorageUploadError(upErr));
        return;
      }
      const { data: pub } = supabase.storage.from(DEVELOPER_TEAM_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      await patchDeveloperPhoto(publicUrl);
      setTeamPhotoDisplayRev((n) => n + 1);
      setCardPhotoUrl(publicUrl);
      toast.success("Team card photo updated");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? formatStorageUploadError({ message: err.message }) : "Could not upload photo.");
    } finally {
      setCardPhotoUploading(false);
    }
  }

  async function uploadProfileAvatarFile(file: File) {
    const uid = user?.id;
    if (!uid) return;

    const ext = extFromMime(file.type);
    if (!ext) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }

    setProfileAvatarUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${uid}/avatar-${storageObjectSuffix()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        console.error(upErr);
        toast.error(upErr.message || "Could not upload profile photo.");
        return;
      }
      const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        toast.error(j.message ?? "Could not save profile photo.");
        return;
      }
      setProfileAvatarDisplayRev((n) => n + 1);
      setProfile((prev) => (prev ? { ...prev, profileAvatarUrl: publicUrl } : null));
      toast.success("Account profile photo updated");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Could not upload profile photo.");
    } finally {
      setProfileAvatarUploading(false);
    }
  }

  async function removeProfileAvatar() {
    setProfileAvatarUploading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        toast.error(j.message ?? "Could not remove profile photo.");
        return;
      }
      setProfileAvatarDisplayRev((n) => n + 1);
      setProfile((prev) => (prev ? { ...prev, profileAvatarUrl: null } : null));
      toast.success("Account profile photo removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove photo.");
    } finally {
      setProfileAvatarUploading(false);
    }
  }

  async function onProfileAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void uploadProfileAvatarFile(file);
  }

  async function onCardPhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    openCropWithFile(file);
  }

  function onPhotoDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPhotoDragActive(true);
  }

  function onPhotoDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPhotoDragActive(false);
  }

  async function onPhotoDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPhotoDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) openCropWithFile(file);
  }

  async function patchVisibility(next: boolean) {
    setVisibilitySaving(true);
    try {
      const res = await fetch("/api/developer/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnTeamSection: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(j.message ?? "Update failed");
      setShowOnTeamSection(next);
      toast.success(next ? "You may appear on the team section when published." : "You are hidden from the public team section.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update preference.");
    } finally {
      setVisibilitySaving(false);
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
  const cardPhotoDisplaySrc = cardPhotoUrl ? withStorageCacheBust(cardPhotoUrl, teamPhotoDisplayRev) : null;
  /** Landing team card uses only the dedicated team photo — not the account avatar. */
  const previewImg = cardPhotoDisplaySrc;
  const previewInitial = previewName.slice(0, 1).toUpperCase();
  const profileAvatarDisplaySrc = profile?.profileAvatarUrl
    ? withStorageCacheBust(profile.profileAvatarUrl, profileAvatarDisplayRev)
    : null;

  return (
    <AppShell>
      <AppHeader title="Developer" showBack backHref="/app" />

      <div className="mx-auto min-w-0 max-w-3xl space-y-6 px-4 pb-24 pt-4 text-center sm:px-6 lg:px-8">
        <p className="mx-auto min-w-0 max-w-xl text-sm text-muted-foreground">
          Update how you appear in the <strong className="text-foreground">Meet the team</strong> section on the home page.
          An admin controls when the directory is live and order. You can opt in or out of the public listing below.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !profile ? (
          <Card className="mx-auto min-w-0 max-w-lg rounded-2xl border-dashed text-center">
            <CardHeader>
              <CardTitle>No developer profile</CardTitle>
              <CardDescription>Ask an admin to add your account to the team directory.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mx-auto flex min-w-0 max-w-[640px] flex-col gap-8">
            <Card className="min-w-0 w-full rounded-2xl shadow-soft">
              <CardHeader className="min-w-0 space-y-2 text-center">
                <CardTitle className="font-display text-lg">Team card</CardTitle>
                <CardDescription className="break-words text-pretty">
                  <span className="block break-all">Signed in as {profile.profileEmail}.</span>{" "}
                  {profile.published ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Directory published.</span>
                  ) : (
                    <span>Not published yet — an admin can enable the team section when ready.</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid min-w-0 gap-6 text-center">
                <div className="grid min-w-0 gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity</p>
                  <div className="grid min-w-0 gap-2 text-left">
                    <Label htmlFor="cdn">Display name (optional override)</Label>
                    <Input
                      id="cdn"
                      value={cardDisplayName}
                      onChange={(e) => setCardDisplayName(e.target.value)}
                      placeholder={profile.profileDisplayName}
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2 text-left">
                    <Label htmlFor="jt">Title / role</Label>
                    <Input
                      id="jt"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Full-stack engineer"
                      className="min-w-0 rounded-xl"
                    />
                  </div>
                  <div className="grid min-w-0 gap-2 text-left">
                    <Label htmlFor="bio">Short bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="One or two sentences for the landing page."
                      className="min-h-[100px] min-w-0 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="space-y-1 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Public team portrait
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Used only on the home page &quot;Meet the team&quot; card. Separate from your account photo below.
                    </p>
                  </div>
                  <Label htmlFor="team-photo-input" className="sr-only">
                    Upload team card portrait
                  </Label>
                  <input
                    id="team-photo-input"
                    ref={cardPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(ev) => void onCardPhotoFileChange(ev)}
                  />
                  <div className="relative">
                    {cardPhotoUrl ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
                        disabled={cardPhotoUploading}
                        aria-label="Remove team photo"
                        onClick={() => void removeCardPhoto()}
                      >
                        {cardPhotoUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    ) : null}
                    <label
                      htmlFor="team-photo-input"
                      onDragOver={onPhotoDragOver}
                      onDragLeave={onPhotoDragLeave}
                      onDrop={(e) => void onPhotoDrop(e)}
                      className={cn(
                        "relative flex w-full max-w-none cursor-pointer flex-col overflow-hidden rounded-2xl border-2 transition-colors",
                        "aspect-[3/4] max-h-[320px] min-h-[220px] sm:min-h-[260px]",
                        photoDragActive
                          ? "border-primary bg-primary/[0.06] ring-2 ring-primary/25"
                          : "border-dashed border-border/80 bg-muted/25 hover:border-primary/40 hover:bg-muted/40",
                        cardPhotoUrl ? "border-solid border-border/70" : null,
                      )}
                    >
                      {cardPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`team-photo-${teamPhotoDisplayRev}`}
                          src={cardPhotoDisplaySrc ?? cardPhotoUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 shadow-sm ring-1 ring-border/60">
                            {cardPhotoUploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : (
                              <ImagePlus className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground">Add team portrait</p>
                          <p className="text-[11px] text-muted-foreground">Not linked to your account avatar</p>
                        </div>
                      )}
                      {cardPhotoUrl ? (
                        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                          Team
                        </span>
                      ) : null}
                    </label>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Click or drop JPEG, PNG, WebP, or GIF — max 5MB. Crop and zoom before upload.
                  </p>
                </div>

                <div className="grid min-w-0 gap-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="space-y-1 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Account profile photo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Used across the app (e.g. profile, session). Independent from the public team portrait.
                    </p>
                  </div>
                  <Label htmlFor="profile-avatar-input" className="sr-only">
                    Upload account profile photo
                  </Label>
                  <input
                    id="profile-avatar-input"
                    ref={profileAvatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(ev) => void onProfileAvatarFileChange(ev)}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border/70 bg-muted">
                      {profileAvatarDisplaySrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`avatar-${profileAvatarDisplayRev}`}
                          src={profileAvatarDisplaySrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-muted-foreground">
                          {(profile.profileDisplayName ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        disabled={profileAvatarUploading}
                        onClick={() => profileAvatarInputRef.current?.click()}
                      >
                        {profileAvatarUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="mr-2 h-4 w-4" />
                        )}
                        {profile?.profileAvatarUrl ? "Replace" : "Upload"}
                      </Button>
                      {profile?.profileAvatarUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-destructive"
                          disabled={profileAvatarUploading}
                          onClick={() => void removeProfileAvatar()}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF — max 5MB.</p>
                </div>

                <div className="grid min-w-0 gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social links</p>
                  <div className="grid min-w-0 grid-cols-1 gap-3 text-left sm:grid-cols-2">
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
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                    <div className="min-w-0 max-w-md space-y-1">
                      <Label htmlFor="show-team" className="text-sm font-medium">
                        Show on team section
                      </Label>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Allow your card on the public home page when the directory is published. Turn off to stay out of
                        the listing while keeping your developer profile.
                      </p>
                    </div>
                    <Switch
                      id="show-team"
                      checked={showOnTeamSection}
                      disabled={visibilitySaving}
                      onCheckedChange={(v) => void patchVisibility(v)}
                      className="shrink-0 data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className={cn("mx-auto w-full max-w-xs rounded-xl")}
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save changes
                </Button>
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card className="min-w-0 overflow-hidden rounded-2xl border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-card to-card shadow-soft text-center">
                <CardHeader className="min-w-0 pb-2">
                  <div className="flex items-center justify-center gap-2 text-violet-700 dark:text-violet-200">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Preview</span>
                  </div>
                  <CardTitle className="font-display text-lg">Landing card</CardTitle>
                  <CardDescription className="break-words text-center">
                    How you will appear in the public team showcase — uses the{" "}
                    <strong className="font-medium text-foreground">public team portrait</strong> only (not your account
                    photo).
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 px-4 pb-6 sm:px-6">
                  <LandingStylePosterPreview
                    key={`preview-${teamPhotoDisplayRev}-${cardPhotoUrl ?? "none"}`}
                    name={previewName}
                    jobTitle={jobTitle.trim() || "Your title"}
                    bio={bio}
                    imageUrl={previewImg}
                    fallbackInitial={previewInitial}
                  />
                </CardContent>
              </Card>

              <Card className="min-w-0 rounded-2xl shadow-soft text-center">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Team tools</CardTitle>
                  <CardDescription>Quick links for people building MaaCare.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col items-center gap-2">
                  <Button asChild variant="outline" className="w-full max-w-sm justify-center rounded-xl">
                    <Link href="/docs" prefetch>
                      <BookOpen className="mr-2 h-4 w-4" /> Product docs
                    </Link>
                  </Button>
                  {user?.role === "admin" ? (
                    <Button asChild variant="outline" className="w-full max-w-sm justify-center rounded-xl">
                      <Link href="/admin/developer-team" prefetch>
                        <Shield className="mr-2 h-4 w-4" /> Manage team directory
                      </Link>
                    </Button>
                  ) : null}
                  <p className="mx-auto min-w-0 max-w-sm pt-2 text-xs text-muted-foreground">
                    More internal tools can be added here over time (feature flags, staging links, etc.).
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Dialog open={cropOpen} onOpenChange={(open) => !open && endCropSession()}>
        <DialogContent className="max-w-lg gap-4">
          <DialogHeader>
            <DialogTitle>Adjust portrait</DialogTitle>
            <DialogDescription>
              Drag to reposition and use zoom to frame your photo. Output uses the same 3:4 shape as the home page team
              card.
            </DialogDescription>
          </DialogHeader>
          {cropSrc ? (
            <div className="relative h-[260px] w-full overflow-hidden rounded-lg bg-muted sm:h-[320px]">
              <Cropper
                key={cropSrc}
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={CROP_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => {
                  croppedAreaPixelsRef.current = areaPixels;
                  setCroppedAreaPixels(areaPixels);
                }}
              />
            </div>
          ) : null}
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Label htmlFor="crop-zoom">Zoom</Label>
              <span>{zoom.toFixed(2)}×</span>
            </div>
            <Slider
              id="crop-zoom"
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => endCropSession()}>
              Cancel
            </Button>
            <Button type="button" disabled={cardPhotoUploading} onClick={() => void confirmCrop()}>
              {cardPhotoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply &amp; upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
