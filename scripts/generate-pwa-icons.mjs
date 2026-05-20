/**
 * Resizes public/icons/icon-master.png into manifest / favicon sizes.
 * Run: npm run icons:generate
 */
import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public/icons/icon-master.png');
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const s of sizes) {
  await sharp(input)
    .resize(s, s, { fit: 'cover' })
    .png()
    .toFile(join(root, `public/icons/icon-${s}x${s}.png`));
  console.log(`wrote icon-${s}x${s}.png`);
}
