import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isInMapData, toMaxBounds } from '../mapData';

// The index the build script wrote for the map data that is shipped (tests run from the repository root)
const mapFile = (file) => path.join(process.cwd(), 'public', 'map', file);
const index = JSON.parse(fs.readFileSync(mapFile('index.json'), 'utf8'));
const exists = (file) => fs.existsSync(mapFile(file));

describe('isInMapData', () => {
  it('knows the tiles of the detailed Tartu area', () => {
    // Tartu's centre at zoom 14
    expect(isInMapData(index, 'tiles/14/9408/4901.pbf')).toBe(true);
    expect(exists('tiles/14/9408/4901.pbf')).toBe(true);
  });

  it('says no for a detailed tile outside the Tartu area (Tallinn at zoom 14)', () => {
    expect(isInMapData(index, 'tiles/14/9318/4764.pbf')).toBe(false);
    expect(exists('tiles/14/9318/4764.pbf')).toBe(false);
  });

  it('knows the overview tiles of all Estonia, and nothing below the lowest zoom', () => {
    expect(isInMapData(index, 'tiles/9/291/149.pbf')).toBe(true); // Tallinn at zoom 9
    expect(isInMapData(index, 'tiles/5/18/9.pbf')).toBe(false);
    expect(isInMapData(index, 'tiles/15/18816/9802.pbf')).toBe(false);
  });

  it('agrees with the files on disk at the corners of every zoom level', () => {
    for (const [z, [x0, y0, x1, y1]] of Object.entries(index.tileRanges)) {
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        expect(isInMapData(index, `tiles/${z}/${x}/${y}.pbf`)).toBe(true);
        expect(exists(`tiles/${z}/${x}/${y}.pbf`)).toBe(true);
      }
      expect(isInMapData(index, `tiles/${z}/${x0 - 1}/${y0}.pbf`)).toBe(false);
      expect(isInMapData(index, `tiles/${z}/${x1}/${y1 + 1}.pbf`)).toBe(false);
    }
  });

  it('knows the font ranges that are shipped: Latin, Latin Extended, Cyrillic, punctuation', () => {
    for (const range of ['0-255', '256-511', '1024-1279', '8192-8447']) {
      expect(isInMapData(index, `glyphs/noto_sans_regular/${range}.pbf`)).toBe(true);
      expect(exists(`glyphs/noto_sans_bold/${range}.pbf`)).toBe(true);
    }
    expect(isInMapData(index, 'glyphs/noto_sans_regular/19968-20223.pbf')).toBe(false); // CJK
  });

  it('says no for anything else', () => {
    expect(isInMapData(index, 'sprites/base.png')).toBe(false);
    expect(isInMapData(index, 'tiles/14/9408.pbf')).toBe(false);
    expect(isInMapData(index, '')).toBe(false);
  });

  it('the font licence is shipped next to the glyphs', () => {
    expect(fs.readFileSync(mapFile('glyphs/OFL.txt'), 'utf8'))
      .toMatch(/SIL OPEN FONT LICENSE Version 1\.1/);
  });
});

describe('toMaxBounds', () => {
  it('turns the index bounds into [[west, south], [east, north]]', () => {
    expect(toMaxBounds([21.76, 57.5, 28.21, 59.69])).toEqual([[21.76, 57.5], [28.21, 59.69]]);
  });
});
