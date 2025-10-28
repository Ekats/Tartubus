// Script to fetch all routes from Digitransit API and save to static file
// Run with: node scripts/fetchRoutes.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHQL_API_URL = 'https://api.digitransit.fi/routing/v2/finland/gtfs/v1';
const API_KEY = process.env.VITE_DIGITRANSIT_API_KEY;

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

    // Calculate size
    const jsonString = JSON.stringify(routes, null, 2);
    const sizeKB = Buffer.byteLength(jsonString, 'utf8') / 1024;
    const sizeMB = sizeKB / 1024;
    console.log(`📦 Data size: ${sizeMB.toFixed(2)} MB (${sizeKB.toFixed(2)} KB)`);

    // Save to public directory
    const outputDir = path.join(__dirname, '..', 'public', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'routes.json');
    fs.writeFileSync(outputPath, jsonString, 'utf8');
    console.log(`💾 Saved to: ${outputPath}`);

    // Also save a compressed version (minified)
    const compressedPath = path.join(outputDir, 'routes.min.json');
    fs.writeFileSync(compressedPath, JSON.stringify(routes), 'utf8');
    const compressedSizeKB = fs.statSync(compressedPath).size / 1024;
    const compressedSizeMB = compressedSizeKB / 1024;
    console.log(`💾 Saved minified to: ${compressedPath}`);
    console.log(`📦 Minified size: ${compressedSizeMB.toFixed(2)} MB (${compressedSizeKB.toFixed(2)} KB)`);

    console.log('\n✨ Done! Add routes.min.json to your git repository.');
    console.log('💡 Run this script periodically (e.g., weekly) to update route data.');

  } catch (error) {
    console.error('❌ Error fetching routes:', error);
    process.exit(1);
  }
}

fetchRoutes();
