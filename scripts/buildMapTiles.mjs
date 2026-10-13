// Builds the map data the app ships (public/map/): vector tiles, the fonts and the icons the map
// styles ask for, and an index the app reads to know what is there.
//
//   node scripts/buildMapTiles.mjs <path to the versatiles binary> <work folder>
//
// Run by hand when the map data should be refreshed; public/map/ is committed, so a normal build
// downloads nothing. The versatiles CLI (https://github.com/versatiles-org/versatiles-rs/releases)
// cuts the two areas out of the planet file with range requests. The work folder (somewhere outside
// the repository) keeps the cut-out extracts and the downloaded fonts and icons, so a second run
// downloads nothing.
// Tile data: (c) OpenStreetMap contributors (ODbL) and ESA WorldCover 2021 (CC BY 4.0).
// Fonts: Noto Sans (SIL Open Font License, see scripts/mapFontLicense.txt). Icons: VersaTiles (CC0).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const PLANET = 'https://download.versatiles.org/osm.versatiles';
const ASSETS = 'https://tiles.versatiles.org/assets';

// lon_min, lat_min, lon_max, lat_max
const BACKDROP = { name: 'estonia-z9', bbox: [21.76, 57.50, 28.21, 59.69], minZoom: 6, maxZoom: 9 };
// 30 x 30 km around the centre of Tartu (58.3776 N, 26.7290 E). 14 is the deepest level the planet file has.
const DETAIL = { name: 'tartu30-z14', bbox: [26.47172, 58.2427, 26.98628, 58.5125], minZoom: 10, maxZoom: 14 };

// Tile properties the generated styles draw as text (their text-field values)
const TEXT_FIELDS = ['name', 'ref', 'housenumber', 'unit'];
const FONTS = ['noto_sans_regular', 'noto_sans_bold'];
const SPRITES = ['base.json', 'base.png', 'base@2x.json', 'base@2x.png'];

const [versatiles, workArg] = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = workArg && path.resolve(workArg);
if (!versatiles || !work || !path.relative(root, work).startsWith('..')) {
  console.error('Usage: node scripts/buildMapTiles.mjs <path to the versatiles binary> <work folder outside the repository>');
  process.exit(1);
}
const out = path.join(root, 'public', 'map');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 1. Tiles: cut each area (once), unpack it as plain uncompressed z/x/y.pbf files
fs.rmSync(out, { recursive: true, force: true });
const tileRanges = {};
const tileFiles = [];
for (const area of [BACKDROP, DETAIL]) {
  const extract = path.join(work, `${area.name}.versatiles`);
  if (!fs.existsSync(extract)) {
    console.log(`Cutting ${area.name} out of ${PLANET}`);
    fs.mkdirSync(work, { recursive: true });
    execFileSync(versatiles, ['convert', '--bbox', area.bbox.join(','), '--max-zoom', String(area.maxZoom), PLANET, extract], { stdio: 'inherit' });
  }
  const unpacked = path.join(work, `${area.name}-unpacked`);
  fs.rmSync(unpacked, { recursive: true, force: true });
  execFileSync(versatiles, ['convert', '--min-zoom', String(area.minZoom), '--max-zoom', String(area.maxZoom), '-c', 'uncompressed', extract, unpacked], { stdio: 'inherit' });

  for (let z = area.minZoom; z <= area.maxZoom; z++) {
    const range = [Infinity, Infinity, -Infinity, -Infinity];
    let count = 0;
    for (const x of fs.readdirSync(path.join(unpacked, String(z)))) {
      for (const file of fs.readdirSync(path.join(unpacked, String(z), x))) {
        const y = path.basename(file, '.pbf');
        const target = path.join(out, 'tiles', String(z), x, `${y}.pbf`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(unpacked, String(z), x, file), target);
        tileFiles.push(target);
        range[0] = Math.min(range[0], Number(x)); range[1] = Math.min(range[1], Number(y));
        range[2] = Math.max(range[2], Number(x)); range[3] = Math.max(range[3], Number(y));
        count++;
      }
    }
    // The app only knows the rectangle of each level: every tile in it has to exist
    if (count !== (range[2] - range[0] + 1) * (range[3] - range[1] + 1)) {
      throw new Error(`Zoom ${z} of ${area.name} is not a full rectangle of tiles (${count} tiles in ${range})`);
    }
    tileRanges[z] = range;
  }
  fs.rmSync(unpacked, { recursive: true, force: true });
}

// 2. Which glyph ranges (256 characters each) can the labels in these tiles ask for?
const ranges = new Set([0]); // the app's own cluster numbers
for (const file of tileFiles) {
  const tile = new VectorTile(new PbfReader(fs.readFileSync(file)));
  for (const layer of Object.values(tile.layers)) {
    for (let i = 0; i < layer.length; i++) {
      const { properties } = layer.feature(i);
      for (const field of TEXT_FIELDS) {
        const text = properties[field];
        if (typeof text !== 'string') continue;
        // Some labels are drawn in capitals
        for (const char of text + text.toUpperCase()) ranges.add(Math.floor(char.codePointAt(0) / 256));
      }
    }
  }
}

async function download(url, target) {
  if (fs.existsSync(target)) return true;
  await sleep(300); // one request at a time, a few per second
  const response = await fetch(url);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  return true;
}
const publish = (cached, target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(cached, target);
};

// 3. Fonts: those ranges of both fonts. A range the font does not have is left out of the index.
const glyphRanges = [];
const missing = [];
for (const range of [...ranges].sort((a, b) => a - b)) {
  const name = `${range * 256}-${range * 256 + 255}`;
  let found = false;
  for (const font of FONTS) {
    const cached = path.join(work, 'assets', 'glyphs', font, `${name}.pbf`);
    if (await download(`${ASSETS}/glyphs/${font}/${name}.pbf`, cached)) {
      publish(cached, path.join(out, 'glyphs', font, `${name}.pbf`));
      found = true;
    }
  }
  (found ? glyphRanges : missing).push(name);
}
// The fonts' licence asks to be passed on with them
fs.copyFileSync(path.join(root, 'scripts', 'mapFontLicense.txt'), path.join(out, 'glyphs', 'OFL.txt'));

// 4. Icons
for (const file of SPRITES) {
  const cached = path.join(work, 'assets', 'sprites', file);
  if (!await download(`${ASSETS}/sprites/${file}`, cached)) throw new Error(`No ${file} on ${ASSETS}`);
  publish(cached, path.join(out, 'sprites', file));
}

// 5. What the app needs to know about the folder
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({
  bounds: BACKDROP.bbox,
  detailBounds: DETAIL.bbox,
  minzoom: BACKDROP.minZoom,
  maxzoom: DETAIL.maxZoom,
  // per zoom level: x_min, y_min, x_max, y_max of the tiles that exist
  tileRanges,
  glyphRanges,
}));

const size = dir => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(entry => entry.isFile())
  .reduce((sum, entry) => sum + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);
console.log(`Tiles:  ${tileFiles.length} files, ${size(path.join(out, 'tiles'))} bytes`);
console.log(`Glyphs: ${glyphRanges.length} ranges x ${FONTS.length} fonts, ${size(path.join(out, 'glyphs'))} bytes (${glyphRanges.join(', ')})`);
if (missing.length) console.log(`        ranges neither font has: ${missing.join(', ')}`);
console.log(`Icons:  ${size(path.join(out, 'sprites'))} bytes`);
console.log(`Total:  ${size(out)} bytes in ${out}`);
