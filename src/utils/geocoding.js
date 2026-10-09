/**
 * Geocoding utilities
 * Address search goes to the Estonian Land Board's In-ADS gazetteer, which knows the
 * Estonian address forms ("Võru tn 30", "Võru tänav 30") that Nominatim misses. When
 * it finds fewer than 5, Nominatim (OpenStreetMap) fills the list up behind it - it
 * knows place names ("Coop") and queries typed without diacritics ("Voru 30"). Reverse
 * geocoding stays on Nominatim. Both are key-free; privacy-friendly, no tracking
 */

import { haversineDistance } from './geo';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const IN_ADS_BASE_URL = 'https://inaadress.maaamet.ee/inaadress/gazetteer';

const MAX_RESULTS = 5;

// The two services word one address differently, so results this close are one place
const SAME_PLACE_METERS = 50;

// Tartu county - the smallest In-ADS area filter that still covers the parishes
// around the city (Kambja, Luunja, ...); TARTU_BOUNDS trims the rest of the county
const IN_ADS_TARTU_COUNTY = '0079';

// Tartu, Estonia bounding box for search results
const TARTU_BOUNDS = {
  minLat: 58.25,
  maxLat: 58.50,
  minLon: 26.55,
  maxLon: 26.90
};

/**
 * Short, readable label from Nominatim's address parts - its display_name is the
 * whole postal address, far too long for a title ("30, Võru, Riiamäe, Kesklinn,
 * Tartu linn, Tartu maakond, 51010, Eesti")
 * @param {Object} address - Nominatim's `address` object
 * @param {string} [placeName] - Name of a named place (shop, amenity, ...) to lead with
 * @returns {string|null} "Võru 30, Kesklinn, Tartu", or null if there is nothing to show
 */
function shortAddressLabel(address, placeName) {
  if (!address) return null;

  const parts = [];

  // Named places lead with their own name
  if (placeName && placeName !== address.road) {
    parts.push(placeName);
  }

  // Street address
  if (address.road) {
    let street = address.road;
    if (address.house_number) {
      street = `${address.road} ${address.house_number}`;
    }
    parts.push(street);
  }

  // Neighborhood or suburb
  if (address.suburb || address.neighbourhood) {
    parts.push(address.suburb || address.neighbourhood);
  }

  // City/town
  if (address.city || address.town) {
    parts.push(address.city || address.town);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Convert coordinates to a human-readable address
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} Address string
 */
export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TartuBussid/1.0' // Required by Nominatim usage policy
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();

    // Format address nicely
    if (data.address) {
      return shortAddressLabel(data.address) || data.display_name;
    }

    return data.display_name || 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Neighbourhood name out of In-ADS's `asum` ("Kesklinna linnaosa, Riiamäe asum")
 * @param {string} asum - In-ADS `asum` field, may be empty
 * @returns {string|null} "Riiamäe", or null when there is none
 */
function neighbourhoodFromAsum(asum) {
  if (!asum) return null;

  const smallest = asum.split(',').pop().trim(); // "Riiamäe asum"
  return smallest.replace(/\s+asum$/, '') || null;
}

/**
 * Address search against the Estonian Land Board's In-ADS gazetteer
 * @param {string} query - Address to search, a prefix is enough ("Võr")
 * @returns {Promise<Array>} Up to 5 results with {lat, lon, name, display_name}
 */
async function searchInAds(query) {
  try {
    const response = await fetch(
      `${IN_ADS_BASE_URL}?` + new URLSearchParams({
        address: query,
        results: '15', // Trimmed to 5 below, after the bounds filter and deduping
        ehak: IN_ADS_TARTU_COUNTY,
        features: 'EHITISHOONE,TANAV' // Buildings and streets
      })
    );

    if (!response.ok) {
      throw new Error('In-ADS search failed');
    }

    const data = await response.json();
    const results = [];
    const seen = new Set();

    for (const row of data.addresses || []) {
      const lat = parseFloat(row.viitepunkt_b);
      const lon = parseFloat(row.viitepunkt_l);

      if (!row.aadresstekst || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }

      // The county reaches well past the area the app serves
      if (lat < TARTU_BOUNDS.minLat || lat > TARTU_BOUNDS.maxLat ||
          lon < TARTU_BOUNDS.minLon || lon > TARTU_BOUNDS.maxLon) {
        continue;
      }

      // A match on a place rather than an address: leitud_osa is the place's name
      const placeName = row.kvaliteet === 'poi' && row.leitud_osa ? row.leitud_osa : null;

      // One row per building on the plot, so the same address repeats. The place
      // name is part of the key, so two shops at one address both survive
      const key = `${placeName || ''}|${row.aadresstekst}|${row.omavalitsus}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // Located label, so "Võru tn 30, Riiamäe, Tartu linn" reads apart from
      // "Võru mnt 30, Kambja vald" in both the results list and the title
      const label = [placeName, row.aadresstekst, neighbourhoodFromAsum(row.asum), row.omavalitsus].filter(Boolean).join(', ');
      results.push({
        lat,
        lon,
        name: label,
        display_name: label
      });

      if (results.length === 5) {
        break;
      }
    }

    return results;
  } catch (error) {
    console.error('In-ADS search error:', error);
    return [];
  }
}

/**
 * Forward geocoding - convert address to coordinates
 * @param {string} query - Address or place name to search
 * @param {Function} [onPartial] - Called with the In-ADS results before Nominatim is asked,
 *   when there are 1-4 of them; the returned list starts with the same rows
 * @returns {Promise<Array>} Array of search results with {lat, lon, name, display_name}
 */
export async function forwardGeocode(query, onPartial) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const results = await searchInAds(query);
  if (results.length >= MAX_RESULTS) {
    return results;
  }
  if (results.length > 0 && onPartial) {
    onPartial([...results]); // A copy: the fillers are pushed onto `results` below
  }

  // Only when In-ADS found fewer than 5, and only after it: Nominatim's usage policy
  // allows one request per second, so the two searches never run in parallel.
  // Its results fill the list up behind the In-ADS ones, minus places already in it
  for (const result of await searchNominatim(query)) {
    if (results.length >= MAX_RESULTS) break;
    // Same place by position, or the same label (which the user couldn't tell apart)
    if (!results.some(r => r.name === result.name ||
        haversineDistance(r.lat, r.lon, result.lat, result.lon) < SAME_PLACE_METERS)) {
      results.push(result);
    }
  }
  return results;
}

/**
 * Address search against Nominatim (OpenStreetMap)
 * @param {string} query - Address or place name to search
 * @returns {Promise<Array>} Array of search results with {lat, lon, name, display_name, address}
 */
async function searchNominatim(query) {
  try {
    // Search within Tartu bounding box for better results
    const viewbox = `${TARTU_BOUNDS.minLon},${TARTU_BOUNDS.maxLat},${TARTU_BOUNDS.maxLon},${TARTU_BOUNDS.minLat}`;
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?` + new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        viewbox: viewbox,
        bounded: '1', // Restrict to viewbox
        countrycodes: 'ee' // Restrict to Estonia
      }),
      {
        headers: {
          'User-Agent': 'TartuBussid/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Forward geocoding failed');
    }

    const data = await response.json();
    return data.map(result => {
      // Nominatim repeats a named place under the key its addresstype names
      const placeName = result.name || result.address?.[result.addresstype] || result.address?.[result.type];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        name: shortAddressLabel(result.address, placeName) || result.display_name,
        display_name: result.display_name,
        address: result.address
      };
    });
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return [];
  }
}
