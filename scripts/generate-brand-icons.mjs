/**
 * Generates square PWA, OG, and push notification icons from the source mark.
 * Run: node scripts/generate-brand-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");

const SOURCE_CANDIDATES = [
  path.join(iconsDir, "maacare-source.png"),
  path.join(iconsDir, "maacare-192.png"),
  path.join(root, "public", "maacare-logo.png"),
];

const BG = { r: 253, g: 246, b: 243, alpha: 1 };
const BRAND = "#c45c6a";

function resolveSource() {
  for (const p of SOURCE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`No source logo found. Add maacare-source.png or maacare-192.png under public/icons/`);
}

async function squareIcon(source, size, outPath, { padding = 0.14, background = BG } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(source).resize(inner, inner, { fit: "contain", background }).png().toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  console.log(`  ✓ ${path.relative(root, outPath)} (${size}×${size})`);
}

async function maskableIcon(source, size, outPath) {
  await squareIcon(source, size, outPath, { padding: 0.22 });
}

async function notificationBadge(notificationIconPath, size, outPath) {
  await sharp(notificationIconPath)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(root, outPath)} (badge ${size}×${size})`);
}

async function ogImage(source, outPath) {
  const w = 1200;
  const h = 630;
  const markSize = 220;
  const mark = await sharp(source)
    .resize(markSize, markSize, { fit: "contain", background: BG })
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

  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([
      { input: mark, top: Math.round((h - markSize) / 2) - 20, left: 80 },
      { input: titleSvg, top: Math.round((h - markSize) / 2) - 10, left: 80 + markSize + 40 },
      { input: subtitleSvg, top: Math.round((h - markSize) / 2) + 70, left: 80 + markSize + 40 },
      {
        input: Buffer.from(
          `<svg width="${w}" height="8" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="8" fill="${BRAND}"/></svg>`,
        ),
        top: h - 8,
        left: 0,
      },
    ])
    .png()
    .toFile(outPath);

  console.log(`  ✓ ${path.relative(root, outPath)} (1200×630 OG)`);
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  const source = resolveSource();
  console.log(`Source: ${path.relative(root, source)}`);

  await squareIcon(source, 192, path.join(iconsDir, "maacare-192.png"));
  await squareIcon(source, 512, path.join(iconsDir, "maacare-512.png"));
  await squareIcon(source, 180, path.join(iconsDir, "apple-touch-icon.png"));
  await maskableIcon(source, 512, path.join(iconsDir, "maacare-maskable-512.png"));
  const notificationIcon = path.join(iconsDir, "notification-icon-192.png");
  await squareIcon(source, 192, notificationIcon, { padding: 0.18 });
  await notificationBadge(notificationIcon, 72, path.join(iconsDir, "notification-badge-72.png"));
  await ogImage(source, path.join(iconsDir, "og-image.png"));

  console.log("\nDone. Commit public/icons/*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
