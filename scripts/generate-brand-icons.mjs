/**
 * Generates PWA, OG, and push assets from public/icons/logo.png — no background or padding.
 * Run: npm run generate-brand-icons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");

const SOURCE_CANDIDATES = [
  path.join(iconsDir, "logo.png"),
  path.join(root, "public", "logo.png"),
  path.join(iconsDir, "maacare-source.png"),
  path.join(root, "public", "maacare-logo.png"),
];

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

function resolveSource() {
  for (const p of SOURCE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`No source logo found. Add public/icons/logo.png (or public/logo.png).`);
}

/** Fit logo inside size×size canvas — transparent, no extra padding or fill color. */
async function fitIcon(source, size, outPath) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(root, outPath)} (${size}×${size})`);
}

async function ogImage(source, outPath) {
  const w = 1200;
  const h = 630;
  const markSize = 280;
  const mark = await sharp(source)
    .resize(markSize, markSize, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

  const titleSvg = Buffer.from(`
    <svg width="720" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="88" font-family="system-ui,Segoe UI,sans-serif" font-size="72" font-weight="700" fill="#2d2428">MaaCare</text>
    </svg>`);

  const subtitleSvg = Buffer.from(`
    <svg width="720" height="60" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="42" font-family="system-ui,Segoe UI,sans-serif" font-size="32" fill="#6b5d62">AI Maternal Health Companion</text>
    </svg>`);

  const markLeft = 80;
  const markTop = Math.round((h - markSize) / 2) - 20;

  await sharp({
    create: { width: w, height: h, channels: 4, background: TRANSPARENT },
  })
    .composite([
      { input: mark, top: markTop, left: markLeft },
      { input: titleSvg, top: markTop + 10, left: markLeft + markSize + 40 },
      { input: subtitleSvg, top: markTop + 90, left: markLeft + markSize + 40 },
    ])
    .png()
    .toFile(outPath);

  console.log(`  ✓ ${path.relative(root, outPath)} (1200×630 OG)`);
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  const source = resolveSource();
  console.log(`Source: ${path.relative(root, source)} (transparent, no padding)`);

  await fitIcon(source, 192, path.join(iconsDir, "maacare-192.png"));
  await fitIcon(source, 512, path.join(iconsDir, "maacare-512.png"));
  await fitIcon(source, 180, path.join(iconsDir, "apple-touch-icon.png"));
  await fitIcon(source, 512, path.join(iconsDir, "maacare-maskable-512.png"));
  await fitIcon(source, 192, path.join(iconsDir, "notification-icon-192.png"));
  await fitIcon(source, 72, path.join(iconsDir, "notification-badge-72.png"));
  await ogImage(source, path.join(iconsDir, "og-image.png"));

  console.log("\nDone. UI uses public/icons/logo.png directly.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
