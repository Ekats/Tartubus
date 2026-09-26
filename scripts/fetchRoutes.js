// Script to fetch all routes from Digitransit API and save to static file
// Run with: node scripts/fetchRoutes.js

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { CITY_ZONES, isRouteInZone } from '../src/utils/geo.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHQL_API_URL = 'https://api.digitransit.fi/routing/v2/finland/gtfs/v1';
const API_KEY = process.env.VITE_DIGITRANSIT_API_KEY;
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'routes.min.json');

/**
 * Keep only routes that serve a supported city zone (the app only uses routes
 * inside a zone), sorted by gtfsId so unchanged data gives identical output.
 * Returns the file contents to write, or null when the routes are unchanged.
 */
export function buildRoutesFile(allRoutes, existingJson = null, now = new Date()) {
  const zones = Object.values(CITY_ZONES);
  const routes = allRoutes
    .filter(route => zones.some(zone => isRouteInZone(route, zone)))
    .sort((a, b) => (a.gtfsId < b.gtfsId ? -1 : a.gtfsId > b.gtfsId ? 1 : 0));

  const contentHash = crypto.createHash('sha256').update(JSON.stringify(routes)).digest('hex');

  if (existingJson) {
    try {
      if (JSON.parse(existingJson).contentHash === contentHash) {
        return null;
      }
    } catch {
      // Unreadable existing file - overwrite it
    }
  }

  return JSON.stringify({
    lastUpdated: now.toISOString(),
    version: now.getTime(),
    contentHash,
    routeCount: routes.length,
    routes
  });
}

async function fetchRoutes() {
  console.log('🔄 Fetching all routes from Digitransit API...');

  const graphqlQuery = `
    query GetAllRoutes {
      routes(feeds: ["Viro"]) {
        gtfsId
        shortName
        longName
        mode
        patterns {
          code
          directionId
          headsign
          stops {
            name
            code
            gtfsId
            lat
            lon
          }
          geometry {
            lat
            lon
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'digitransit-subscription-key': API_KEY,
      },
      body: JSON.stringify({
        query: graphqlQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const routes = result.data.routes || [];
    console.log(`✅ Fetched ${routes.length} routes`);

    const existingJson = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : null;
    const output = buildRoutesFile(routes, existingJson);

    if (output === null) {
      console.log('✅ Route data unchanged - leaving routes.min.json as is');
      return;
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
    const sizeMB = fs.statSync(OUTPUT_PATH).size / 1024 / 1024;
    console.log(`💾 Saved ${JSON.parse(output).routeCount} routes in city zones to: ${OUTPUT_PATH}`);
    console.log(`📦 Size: ${sizeMB.toFixed(2)} MB`);

    console.log('\n✨ Done! Add routes.min.json to your git repository.');
    console.log('💡 Run this script periodically (e.g., weekly) to update route data.');

  } catch (error) {
    console.error('❌ Error fetching routes:', error);
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchRoutes();
}
