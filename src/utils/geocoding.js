/**
 * Geocoding utilities using Nominatim API (OpenStreetMap)
 * Privacy-friendly, no tracking
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Tartu, Estonia bounding box for search results
const TARTU_BOUNDS = {
  minLat: 58.25,
  maxLat: 58.50,
  minLon: 26.55,
  maxLon: 26.90
};

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
      const parts = [];

      // Street address
      if (data.address.road) {
        let street = data.address.road;
        if (data.address.house_number) {
          street = `${data.address.road} ${data.address.house_number}`;
        }
        parts.push(street);
      }

      // Neighborhood or suburb
      if (data.address.suburb || data.address.neighbourhood) {
        parts.push(data.address.suburb || data.address.neighbourhood);
      }

      // City/town
      if (data.address.city || data.address.town) {
        parts.push(data.address.city || data.address.town);
      }

      return parts.length > 0 ? parts.join(', ') : data.display_name;
    }

    return data.display_name || 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Forward geocoding - convert address to coordinates
 * @param {string} query - Address or place name to search
 * @returns {Promise<Array>} Array of search results with {lat, lon, display_name}
 */
export async function forwardGeocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

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
    return data.map(result => ({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
      address: result.address
    }));
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return [];
  }
}
