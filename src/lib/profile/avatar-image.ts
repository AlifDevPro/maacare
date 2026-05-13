import type { Area } from "react-easy-crop";

/** Max side length for stored avatar JPEG after crop (clarity vs size). */
export const AVATAR_OUTPUT_MAX_SIDE = 720;

export function extFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

export function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    if (url.startsWith("http://") || url.startsWith("https://")) {
      image.crossOrigin = "anonymous";
    }
    image.src = url;
  });
}

/** Square crop centered in image pixel space when crop callback has not fired yet. */
export function centerSquareCropAreaPixels(naturalWidth: number, naturalHeight: number): Area {
  const nw = naturalWidth;
  const nh = naturalHeight;
  if (nw >= nh) {
    const side = nh;
    return { x: (nw - side) / 2, y: 0, width: side, height: side };
  }
  const side = nw;
  return { x: 0, y: (nh - side) / 2, width: side, height: side };
}

/** Bounding box of naturalWidth × naturalHeight image after rotation (matches react-easy-crop). */
function rotateSize(width: number, height: number, rotationDeg: number) {
  const rotRad = (rotationDeg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Export JPEG from react-easy-crop output. `pixelCrop` is in **rotated bounding-box** coordinates
 * (same space as `croppedAreaPixels` from `onCropComplete`).
 */
export async function getCroppedImageBlobFromEasyCrop(
  imageSrc: string,
  pixelCrop: Area,
  rotationDeg: number,
): Promise<Blob> {
  const image = await createImageElement(imageSrc);
  if (image.decode) {
    try {
      await image.decode();
    } catch {
      /* optional */
    }
  }
  const nw = image.naturalWidth;
  const nh = image.naturalHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  const rotRad = (rotationDeg * Math.PI) / 180;
  const { width: boxW, height: boxH } = rotateSize(nw, nh, rotationDeg);
  canvas.width = Math.max(1, Math.round(boxW));
  canvas.height = Math.max(1, Math.round(boxH));

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -nw / 2, -nh / 2);

  const out = document.createElement("canvas");
  const ow = Math.max(1, Math.round(pixelCrop.width));
  const oh = Math.max(1, Math.round(pixelCrop.height));
  out.width = ow;
  out.height = oh;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Could not create canvas context.");

  octx.drawImage(canvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, ow, oh);

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

/** Downscale square-ish JPEG blob so max(width,height) <= maxSide. */
export async function downscaleJpegBlob(blob: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    const max = Math.max(w, h);
    if (max <= maxSide) {
      return blob;
    }
    const scale = maxSide / max;
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context.");
    ctx.drawImage(bitmap, 0, 0, nw, nh);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (out) => {
          if (out) resolve(out);
          else reject(new Error("Could not resize image."));
        },
        "image/jpeg",
        0.9,
      );
    });
  } finally {
    bitmap.close();
  }
}
