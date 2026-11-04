// Generates PWA icons from app/icon.svg. Run with: npm run icons:build
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "app", "icon.svg"));
const outDir = path.join(root, "public", "icons");
await mkdir(outDir, { recursive: true });

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(outDir, name));
  console.log(`wrote public/icons/${name}`);
}

// Maskable icon: keep the artwork inside the 80% safe zone.
const inner = Math.round(512 * 0.78);
const artwork = await sharp(source, { density: 384 }).resize(inner, inner, { fit: "contain" }).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#0f131d" },
})
  .composite([{ input: artwork, gravity: "center" }])
  .png()
  .toFile(path.join(outDir, "icon-maskable-512.png"));
console.log("wrote public/icons/icon-maskable-512.png");
