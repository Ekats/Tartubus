/**
 * Reverse geocoding utility using Nominatim API (OpenStreetMap)
 * Privacy-friendly, no tracking
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

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
