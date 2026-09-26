/**
 * Shared geography helpers
 */

// City zones the app supports. A route belongs to a zone when any of its
// pattern stops lies within the zone's radius of the zone's centre.
export const CITY_ZONES = {
  tartu: {
    name: 'Tartu',
    center: { lat: 58.3776, lon: 26.7290 },
    radius: 8000, // 8km radius (reduced from 15km)
    feed: 'Viro',
    cityFilter: 'Tartu' // Filter routes by city name
  },
  tallinn: {
    name: 'Tallinn',
    center: { lat: 59.4370, lon: 24.7536 },
    radius: 20000, // 20km radius
    feed: 'Viro',
    cityFilter: 'Tallinn'
  },
  // Add more cities as needed
};

/**
 * Great-circle distance between two coordinates in meters (haversine)
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Check whether any stop of any pattern of a route lies inside a city zone
 */
export function isRouteInZone(route, zone) {
  return (route.patterns || []).some(pattern =>
    (pattern.stops || []).some(stop =>
      haversineDistance(zone.center.lat, zone.center.lon, stop.lat, stop.lon) <= zone.radius
    )
  );
}
