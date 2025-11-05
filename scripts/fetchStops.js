// Script to fetch all stops in Tartu area and save to stops.json
// This creates a lightweight file with just coordinates and basic info

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIGITRANSIT_API = 'https://api.digitransit.fi/routing/v2/finland/gtfs/v1';
const API_KEY = 'b382044ff66f4e598cf2515ae8507b3e';

// Tartu city center coordinates and search radius
const TARTU_CENTER = {
  lat: 58.3802,
  lon: 26.7209
};
const SEARCH_RADIUS = 15000; // 15km to cover all of Tartu

async function fetchAllStops() {
  console.log('🔍 Fetching all stops in Tartu area...');

  const query = `
    query {
      stopsByRadius(
        lat: ${TARTU_CENTER.lat}
        lon: ${TARTU_CENTER.lon}
        radius: ${SEARCH_RADIUS}
        first: 5000
      ) {
        edges {
          node {
            stop {
              gtfsId
              name
              code
              lat
              lon
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(DIGITRANSIT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'digitransit-subscription-key': API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    // Extract stops from response
    const stops = data.data.stopsByRadius.edges.map(edge => edge.node.stop);

    // Remove duplicates (same gtfsId)
    const uniqueStops = Array.from(
      new Map(stops.map(stop => [stop.gtfsId, stop])).values()
    );

    console.log(`✅ Found ${uniqueStops.length} unique stops`);

    // Calculate file size estimate
    const jsonStr = JSON.stringify(uniqueStops, null, 2);
    const sizeInBytes = Buffer.byteLength(jsonStr, 'utf8');
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    console.log(`📦 File size: ${sizeInKB} KB (${sizeInMB} MB)`);

    // Save to public/data/stops.json
    const outputPath = path.join(__dirname, '..', 'public', 'data', 'stops.json');
    fs.writeFileSync(outputPath, jsonStr);

    console.log(`💾 Saved to: ${outputPath}`);
    console.log('✅ Done!');

    return uniqueStops;
  } catch (error) {
    console.error('❌ Error fetching stops:', error);
    throw error;
  }
}

// Run the script
fetchAllStops().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
