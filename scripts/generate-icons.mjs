import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const svgPath = path.join(assetsDir, "icon.svg");
const svgBuffer = fs.readFileSync(svgPath);

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generate() {
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(assetsDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Main icon (256px as default)
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(assetsDir, "icon.png"));
  console.log("Generated icon.png (256x256)");

  // ICO needs 256px PNG (Electron uses PNG directly on most platforms)
  console.log("\nDone! Reference assets/icon.png in forge.config.ts");
}

generate().catch(console.error);
