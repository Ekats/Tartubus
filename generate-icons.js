import sharp from 'sharp';
import { mkdirSync } from 'fs';

// All icons come from the app artwork in resources/icon.png (the red bus,
// transparent background) - the same source as the Android launcher icons
const SOURCE = './resources/icon.png';

// Web app / favicon icons: the bus on white, 78 % of the width, like the
// Android adaptive icon, so it stays inside round "maskable" icon shapes
async function appIcon(size, output) {
  const bus = await sharp(SOURCE)
    .trim()
    .resize({ width: Math.round(size * 0.78), height: Math.round(size * 0.78), fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: '#ffffff' }
  })
    .composite([{ input: bus, gravity: 'center' }])
    .png()
    .toFile(output);
}

async function generateIcons() {
  await appIcon(192, './public/icon-192.png');
  await appIcon(512, './public/icon-512.png');

  // In-app bus icon (replaces the bus emoji): trimmed, transparent, 96 px tall
  // so it stays sharp at up to 32 px on 3x screens
  mkdirSync('./src/assets', { recursive: true });
  await sharp(SOURCE)
    .trim()
    .resize({ height: 96 })
    .png({ compressionLevel: 9, palette: true })
    .toFile('./src/assets/bus.png');

  console.log('✅ Icons generated successfully!');
}

generateIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
