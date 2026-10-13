// The pictures the map layers draw: stop rings, the favourite star, direction arrows. Each has a
// name (see utils/mapFeatures.js); the picture is drawn once, at 3x so it stays sharp, and kept.
import { mapIsAlive, styleIsReady } from './mapState';

const RATIO = 3;

// A stop: white disc, coloured ring, coloured dot. 24 px, or 32 px for a nearby stop.
const stopSvg = (color, isLarge) => {
  const size = isLarge ? 32 : 24;
  const dotSize = isLarge ? 10 : 8;
  return [size, `
    <svg width="${size * RATIO}" height="${size * RATIO}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="white" filter="url(#shadow)"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="none" stroke="${color}" stroke-width="2.5"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${dotSize / 2}" fill="${color}"/>
    </svg>`];
};

// A favourite stop: golden star in a white disc. 36 px, or 48 px when nearby.
const favoriteSvg = (isLarge) => {
  const size = isLarge ? 48 : 36;
  return [size, `
    <svg width="${size * RATIO}" height="${size * RATIO}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-fav">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/>
        </filter>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#FCD34D" opacity="0.3"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="white" filter="url(#shadow-fav)"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="none" stroke="#FBBF24" stroke-width="2.5"/>
      <g transform="translate(${size / 2}, ${size / 2})">
        <path d="M 0,-${size / 3} L ${size / 9},-${size / 9} L ${size / 3},-${size / 10} L ${size / 7},${size / 10} L ${size / 6},${size / 3} L 0,${size / 6} L -${size / 6},${size / 3} L -${size / 7},${size / 10} L -${size / 3},-${size / 10} L -${size / 9},-${size / 9} Z"
              fill="#FBBF24" stroke="#F59E0B" stroke-width="2" filter="url(#shadow-fav)"/>
      </g>
    </svg>`];
};

// A direction arrow on a route line: an open arrowhead pointing along the line (to the right here)
const arrowSvg = (color) => [16, `
    <svg width="${16 * RATIO}" height="${16 * RATIO}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M 3.6,2 L 14,8 L 3.6,14" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.8"/>
    </svg>`];

const svgImage = ([size, svg]) => new Promise((resolve, reject) => {
  const img = new Image(size * RATIO, size * RATIO);
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not draw a map icon'));
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

// The star of a cluster that holds a favourite stop: the emoji with a white glow, 40 px
const STAR_BOX = 56;
const clusterStar = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = STAR_BOX * RATIO;
  const ctx = canvas.getContext('2d');
  ctx.scale(RATIO, RATIO);
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, 1)';
  for (const blur of [10, 6, 3]) {
    ctx.shadowBlur = blur;
    ctx.fillText('⭐', STAR_BOX / 2, STAR_BOX / 2 + 2);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export const CLUSTER_STAR = 'cluster-star';
export const arrowIconName = (color) => `arrow|${color}`;

const draw = (name) => {
  const [kind, a, b] = name.split('|');
  if (kind === 'stop') return svgImage(stopSvg(a, b === 'large'));
  if (kind === 'favorite') return svgImage(favoriteSvg(a === 'large'));
  if (kind === 'arrow') return svgImage(arrowSvg(a));
  if (name === CLUSTER_STAR) return Promise.resolve(clusterStar());
  return Promise.reject(new Error(`Unknown map icon ${name}`));
};

const drawn = new Map();
const loadIcon = (name) => {
  if (!drawn.has(name)) drawn.set(name, draw(name));
  return drawn.get(name);
};

/** Makes sure the map's style has these icons. Resolves to false when the map went away meanwhile. */
export async function ensureIcons(map, names) {
  const wanted = [...new Set(names)].filter(name => !(mapIsAlive(map) && map.hasImage(name)));
  const images = await Promise.all(wanted.map(loadIcon));
  if (!styleIsReady(map)) return false;
  wanted.forEach((name, i) => {
    if (!map.hasImage(name)) map.addImage(name, images[i], { pixelRatio: RATIO });
  });
  return true;
}
