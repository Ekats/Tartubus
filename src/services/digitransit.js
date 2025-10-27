// Use Routing v2 Finland GraphQL API
const isDev = import.meta.env.DEV;
const API_BASE = isDev ? '/api/digitransit' : 'https://api.digitransit.fi';
const GRAPHQL_API_URL = `${API_BASE}/routing/v2/finland/gtfs/v1`;
const API_KEY = import.meta.env.VITE_DIGITRANSIT_API_KEY;

/**
 * Generic GraphQL query function
 */
async function query(graphqlQuery, variables = {}) {
  try {
    const requestBody = {
      query: graphqlQuery,
      variables,
    };

    const response = await fetch(GRAPHQL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'digitransit-subscription-key': API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', response.status, response.statusText, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  } catch (error) {
    console.error('Digitransit API error:', error);
    throw error;
  }
}

/**
 * Get nearby stops with next departures
 */
export async function getNearbyStops(lat, lon, radius = 500) {
  // Check cache first
  const cachedStops = getCachedNearbyStops(lat, lon, radius);
  if (cachedStops) {
    return cachedStops;
  }

  const graphqlQuery = `
    query GetNearbyStops($lat: Float!, $lon: Float!, $radius: Int!) {
      stopsByRadius(lat: $lat, lon: $lon, radius: $radius) {
        edges {
          node {
            stop {
              gtfsId
              name
              code
              lat
              lon
              stoptimesWithoutPatterns(numberOfDepartures: 5) {
                scheduledArrival
                scheduledDeparture
                headsign
                trip {
                  route {
                    shortName
                    longName
                    gtfsId
                  }
                }
              }
            }
            distance
          }
        }
      }
    }
  `;

  try {
    const data = await query(graphqlQuery, { lat, lon, radius });

    const stops = data.stopsByRadius?.edges || [];

    // Filter for Tartu stops only (Viro: prefix)
    const tartuStops = stops.filter(edge => {
      const gtfsId = edge.node.stop.gtfsId || '';
      return gtfsId.startsWith('Viro:');
    });

    const result = tartuStops.map(edge => ({
      ...edge.node.stop,
      distance: edge.node.distance,
    }));

    // Cache the result
    setCachedNearbyStops(lat, lon, radius, result);

    return result;

  } catch (error) {
    console.error('Error fetching nearby stops:', error);
    throw error;
  }
}

/**
 * Get bus stops near a location
 */
export async function getStops(lat, lon, radius = 500) {
  const graphqlQuery = `
    query GetStops($lat: Float!, $lon: Float!, $radius: Int!) {
      stopsByRadius(lat: $lat, lon: $lon, radius: $radius) {
        edges {
          node {
            stop {
              gtfsId
              name
              code
              lat
              lon
              stoptimesWithoutPatterns(numberOfDepartures: 5) {
                scheduledArrival
                realtimeArrival
                arrivalDelay
                realtime
                headsign
                trip {
                  route {
                    shortName
                    longName
                  }
                }
              }
            }
            distance
          }
        }
      }
    }
  `;

  const data = await query(graphqlQuery, { lat, lon, radius });
  return data.stopsByRadius?.edges || [];
}

/**
 * Plan a journey from origin to destination
 */
export async function planJourney(from, to, numItineraries = 3) {
  const graphqlQuery = `
    query PlanRoute($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $numItineraries: Int!) {
      plan(
        from: { lat: $fromLat, lon: $fromLon }
        to: { lat: $toLat, lon: $toLon }
        numItineraries: $numItineraries
        transportModes: [{ mode: BUS }, { mode: WALK }]
      ) {
        itineraries {
          startTime
          endTime
          duration
          walkDistance
          legs {
            mode
            distance
            duration
            from {
              name
              lat
              lon
              stop {
                name
                code
                gtfsId
              }
            }
            to {
              name
              lat
              lon
              stop {
                name
                code
                gtfsId
              }
            }
            route {
              shortName
              longName
              gtfsId
            }
            startTime
            endTime
            realTime
            intermediateStops {
              name
              lat
              lon
            }
            legGeometry {
              points
            }
          }
        }
      }
    }
  `;

  const data = await query(graphqlQuery, {
    fromLat: from.lat,
    fromLon: from.lon,
    toLat: to.lat,
    toLon: to.lon,
    numItineraries,
  });

  return data.plan?.itineraries || [];
}

/**
 * Get all bus routes
 */
export async function getRoutes() {
  const graphqlQuery = `
    query GetRoutes {
      routes {
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
            gtfsId
            lat
            lon
          }
        }
      }
    }
  `;

  const data = await query(graphqlQuery);

  // Filter for Tartu city routes
  const tartuRoutes = (data.routes || []).filter(route => {
    const gtfsId = route.gtfsId || '';
    return gtfsId.toUpperCase().includes('TARTU');
  });

  return tartuRoutes;
}

/**
 * Decode polyline encoded string to lat/lng coordinates
 */
function decodePolyline(encoded) {
  if (!encoded) return [];

  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

// Cache expiration times
// Route geometry and stops almost never change - cache for 1 year
const ROUTE_CACHE_DURATION = 365 * 24 * 60 * 60 * 1000;
// Nearby stops include departure times, so cache for shorter period (5 minutes)
const STOPS_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Get cached data from localStorage with expiration check
 */
function getCachedData(cacheKey, cacheDuration, cacheType = 'route') {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    // Check if cache is still valid
    if (age < cacheDuration) {
      const ageMinutes = Math.round(age / 60000);
      const ageHours = Math.round(age / 3600000);
      const ageDays = Math.round(age / 86400000);
      const ageDisplay = ageDays > 0 ? `${ageDays}d` : (ageHours > 0 ? `${ageHours}h` : `${ageMinutes}m`);
      console.log(`✅ Using cached ${cacheType} data (age: ${ageDisplay})`);
      return data;
    } else {
      // Cache expired, remove it
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.warn(`Error reading ${cacheType} cache:`, error);
    return null;
  }
}

/**
 * Get cached route data from localStorage
 */
function getCachedRouteData(cacheKey) {
  return getCachedData(`route_${cacheKey}`, ROUTE_CACHE_DURATION, 'route');
}

/**
 * Save data to localStorage cache
 */
function setCachedData(cacheKey, data) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Error writing cache:', error);
  }
}

/**
 * Save route data to localStorage cache
 */
function setCachedRouteData(cacheKey, data) {
  setCachedData(`route_${cacheKey}`, data);
}

/**
 * Get cached nearby stops data
 */
function getCachedNearbyStops(lat, lon, radius) {
  // Round coordinates to avoid cache misses from tiny location differences
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  const cacheKey = `stops_${roundedLat}_${roundedLon}_${radius}`;
  return getCachedData(cacheKey, STOPS_CACHE_DURATION, 'stops');
}

/**
 * Save nearby stops data to cache
 */
function setCachedNearbyStops(lat, lon, radius, data) {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  const cacheKey = `stops_${roundedLat}_${roundedLon}_${radius}`;
  setCachedData(cacheKey, data);
}

/**
 * Get all stops for specific routes by route short names with proper geometry
 */
export async function getStopsByRoutes(routeShortNames) {
  // Create cache key from sorted route names
  const cacheKey = [...routeShortNames].sort().join(',');

  // Check if we have cached data
  const cachedData = getCachedRouteData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  console.log('🔄 Fetching route data from API for:', routeShortNames);

  const graphqlQuery = `
    query GetRoutes {
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
    const data = await query(graphqlQuery);
    const allRoutes = data.routes || [];

    // Filter for selected routes
    const selectedRoutes = allRoutes.filter(route =>
      routeShortNames.includes(route.shortName)
    );

    // Collect all unique stops and their patterns
    const stopsMap = new Map();
    const routePatterns = [];

    selectedRoutes.forEach(route => {
      // Group patterns by directionId to avoid duplicates
      const patternsByDirection = new Map();

      route.patterns?.forEach(pattern => {
        // Use 0 as default if directionId is negative, null, or undefined
        const dir = (pattern.directionId >= 0) ? pattern.directionId : 0;

        // Only keep the first pattern for each direction (longest route usually)
        if (!patternsByDirection.has(dir) ||
            (pattern.stops?.length || 0) > (patternsByDirection.get(dir).stops?.length || 0)) {
          patternsByDirection.set(dir, pattern);
        }
      });

      // Process unique direction patterns
      patternsByDirection.forEach((pattern, directionId) => {
        // Get geometry - use pattern geometry if available, otherwise connect stops
        let coordinates = [];
        if (pattern.geometry && pattern.geometry.length > 0) {
          // Use the provided geometry that follows roads
          coordinates = pattern.geometry.map(point => [point.lat, point.lon]);
        } else {
          // Fallback to connecting stops directly
          coordinates = (pattern.stops || []).map(stop => [stop.lat, stop.lon]);
        }

        // Store pattern for drawing lines
        routePatterns.push({
          routeShortName: route.shortName,
          directionId: directionId,
          headsign: pattern.headsign,
          coordinates: coordinates,
          stops: pattern.stops || []
        });

        // Collect all stops
        pattern.stops?.forEach(stop => {
          if (!stopsMap.has(stop.gtfsId)) {
            stopsMap.set(stop.gtfsId, {
              ...stop,
              stoptimesWithoutPatterns: [], // Will be empty but keeps structure consistent
            });
          }
        });
      });
    });

    const stops = Array.from(stopsMap.values());

    const result = { stops, routePatterns };

    // Cache the result in localStorage
    setCachedRouteData(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Error fetching stops by routes:', error);
    throw error;
  }
}
