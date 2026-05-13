"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { ImagePlus, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  AVATAR_OUTPUT_MAX_SIDE,
  centerSquareCropAreaPixels,
  createImageElement,
  downscaleJpegBlob,
  extFromMime,
  getCroppedImageBlobFromEasyCrop,
} from "@/lib/profile/avatar-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATARS_BUCKET = "avatars";

type Phase = "pick" | "crop";

export type ProfileAvatarUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Authenticated user id — use server session id so upload works before client session hydrates. */
  userId: string;
  onBusy?: (busy: boolean) => void;
  onUploaded: (publicUrl: string) => void;
};

export function ProfileAvatarUploadDialog({
  open,
  onOpenChange,
  userId,
  onBusy,
  onUploaded,
}: ProfileAvatarUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const croppedAreaPixelsRef = useRef<Area | null>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const resetInternal = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPhase("pick");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    croppedAreaPixelsRef.current = null;
    setDragActive(false);
  }, [cropSrc]);

  useEffect(() => {
    if (!open) {
      resetInternal();
    }
  }, [open, resetInternal]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function validateAndOpenCrop(file: File) {
    const ext = extFromMime(file.type);
    if (!ext) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    croppedAreaPixelsRef.current = null;
    setPhase("crop");
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) validateAndOpenCrop(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndOpenCrop(file);
  }

  async function confirmAndUpload() {
    if (!cropSrc || !userId) {
      toast.error("No image to save.");
      return;
    }
    let area = croppedAreaPixelsRef.current;
    if (!area) {
      if (rotation !== 0) {
        toast.error("Move or zoom the photo slightly so the crop updates, then try again.");
        return;
      }
      try {
        const img = await createImageElement(cropSrc);
        area = centerSquareCropAreaPixels(img.naturalWidth, img.naturalHeight);
      } catch {
        toast.error("Could not read image for crop.");
        return;
      }
    }

    setUploading(true);
    onBusy?.(true);
    try {
      let blob = await getCroppedImageBlobFromEasyCrop(cropSrc, area, rotation);
      blob = await downscaleJpegBlob(blob, AVATAR_OUTPUT_MAX_SIDE);
      if (blob.size > AVATAR_MAX_BYTES) {
        toast.error("Image is still too large after crop. Try zooming out.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) {
        console.error(upErr);
        toast.error(upErr.message || "Could not upload photo.");
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

      toast.success("Profile photo updated");
      onUploaded(publicUrl);
      onOpenChange(false);
      resetInternal();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
      onBusy?.(false);
    }
  }

  function backToPick() {
    resetInternal();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,760px)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 px-6 pb-2 pt-6">
          <DialogTitle className="font-display text-xl">Profile photo</DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {phase === "pick" ? (
              <>
                Choose a photo where your face is visible. On the next step you can{" "}
                <strong className="text-foreground">zoom</strong>,{" "}
                <strong className="text-foreground">rotate</strong>, and{" "}
                <strong className="text-foreground">frame</strong> it in the circle before saving.
              </>
            ) : (
              <>
                Drag to reposition. Use zoom and rotation to straighten the shot, then save — output is a square image
                used everywhere your avatar appears.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" ? (
          <div className="space-y-4 px-6 pb-6">
            <button
              type="button"
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border/80 bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Drop an image here</p>
                <p className="mt-1 text-xs text-muted-foreground">or click to browse · JPG, PNG, WebP, GIF · max 5&nbsp;MB</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onFileInputChange}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="relative mx-auto aspect-square w-full max-w-[min(100%,340px)] overflow-hidden rounded-2xl bg-muted">
              {cropSrc ? (
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  minZoom={1}
                  maxZoom={3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={(_a, pixels) => {
                    croppedAreaPixelsRef.current = pixels;
                  }}
                />
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  aria-label="Rotate left"
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Rotate left
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  aria-label="Rotate right"
                >
                  <RotateCw className="mr-1 h-4 w-4" />
                  Rotate right
                </Button>
              </div>

              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Label htmlFor="avatar-crop-zoom">Zoom</Label>
                  <span>{zoom.toFixed(2)}×</span>
                </div>
                <Slider
                  id="avatar-crop-zoom"
                  min={1}
                  max={3}
                  step={0.02}
                  value={[zoom]}
                  onValueChange={(v) => setZoom(v[0] ?? 1)}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => backToPick()} disabled={uploading}>
                Choose different photo
              </Button>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button type="button" className="min-w-[9rem]" onClick={() => void confirmAndUpload()} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save photo
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
