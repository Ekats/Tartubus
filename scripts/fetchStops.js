// Script to fetch all stops in Estonia and save to stops.json
// This creates a lightweight file with just coordinates and basic info

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIGITRANSIT_API = 'https://api.digitransit.fi/routing/v2/finland/gtfs/v1';
const API_KEY = 'b382044ff66f4e598cf2515ae8507b3e';

async function fetchAllStops() {
  console.log('🔍 Fetching all stops in Estonia...');

  const query = `
    query {
      stops {
        gtfsId
        name
        code
        lat
        lon
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
    const allStops = data.data.stops || [];

    console.log(`📊 Total stops fetched: ${allStops.length}`);

    // Filter for Estonia (Viro) stops only
    const estoniaStops = allStops.filter(stop =>
      stop.gtfsId && stop.gtfsId.startsWith('Viro:')
    );

    // Remove duplicates (same gtfsId) - shouldn't be any, but just in case
    const uniqueStops = Array.from(
      new Map(estoniaStops.map(stop => [stop.gtfsId, stop])).values()
    );

    console.log(`✅ Found ${uniqueStops.length} stops in Estonia`);

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
