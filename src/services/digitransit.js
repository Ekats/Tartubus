// Use Routing v2 Finland GraphQL API
const isDev = import.meta.env.DEV;
const API_BASE = isDev ? '/api/digitransit' : 'https://api.digitransit.fi';
const GRAPHQL_API_URL = `${API_BASE}/routing/v2/finland/gtfs/v1`;
const API_KEY = import.meta.env.VITE_DIGITRANSIT_API_KEY;

/**
 * Generic GraphQL query function with timeout
 */
async function query(graphqlQuery, variables = {}, timeout = 20000) {
  try {
    const requestBody = {
      query: graphqlQuery,
      variables,
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(GRAPHQL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'digitransit-subscription-key': API_KEY,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your internet connection and try again');
      }
      throw error;
    }
  } catch (error) {
    console.error('Digitransit API error:', error);
    throw error;
  }
}

/**
 * Get nearby stops with next departures
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Search radius in meters
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data
 */
export async function getNearbyStops(lat, lon, radius = 500, forceRefresh = false) {
  // Calculate cache key once
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const cacheKey = `stops_${roundedLat}_${roundedLon}_${radius}`;

  // Check fresh cache first (unless force refresh is requested)
  if (!forceRefresh) {
    const cachedStops = getCachedNearbyStops(lat, lon, radius);
    if (cachedStops) {
      // Reconstruct trip objects from compressed cache
      return cachedStops.map(stop => ({
        ...stop,
        stoptimesWithoutPatterns: stop.stoptimesWithoutPatterns?.map(st => ({
          ...st,
          trip: {
            route: {
              shortName: st.routeShortName,
              longName: st.routeLongName,
              gtfsId: st.routeGtfsId
            },
            stoptimes: st.nextStops?.map(ns => ({
              stop: { gtfsId: null, name: ns.name },
              stopPosition: ns.position
            })) || []
          }
        })) || []
      }));
    }
  } else {
    console.log('🔄 Force refresh requested, bypassing cache');
  }

  // Check if there's already a request in flight for this location
  if (inFlightRequests.has(cacheKey)) {
    console.log(`⏳ Request already in flight for ${cacheKey}, waiting... (forceRefresh=${forceRefresh})`);
    if (forceRefresh) {
      console.log('⚠️ Force refresh but using in-flight request - this might return cached data!');
    }
    return inFlightRequests.get(cacheKey);
  }

  // Try to get stale cache as fallback (in case of network errors)
  const staleCache = getStaleCache(cacheKey);
  console.log(`🔍 Fetching fresh data for ${cacheKey}, stale cache available: ${!!staleCache}`);

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
              stoptimesWithoutPatterns(numberOfDepartures: 20, omitCanceled: false) {
                scheduledArrival
                scheduledDeparture
                headsign
                stopPosition
                trip {
                  route {
                    shortName
                    longName
                    gtfsId
                  }
                  stoptimes {
                    stop {
                      gtfsId
                      name
                    }
                    stopPosition
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

  // Create the request promise
  const requestPromise = (async () => {
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

      // Cache with compressed departure data to save space
      const compressedResult = result.map(stop => ({
        gtfsId: stop.gtfsId,
        name: stop.name,
        code: stop.code,
        lat: stop.lat,
        lon: stop.lon,
        distance: stop.distance,
        // Store only essential departure info (much smaller than full trip data)
        stoptimesWithoutPatterns: stop.stoptimesWithoutPatterns?.map(st => ({
          scheduledArrival: st.scheduledArrival,
          scheduledDeparture: st.scheduledDeparture,
          headsign: st.headsign,
          stopPosition: st.stopPosition,
          routeShortName: st.trip?.route?.shortName,
          routeLongName: st.trip?.route?.longName,
          routeGtfsId: st.trip?.route?.gtfsId,
          // Store only next stops, not full trip.stoptimes array
          nextStops: st.trip?.stoptimes
            ?.filter(s => s.stopPosition > st.stopPosition)
            ?.slice(0, 3)  // Only keep next 3 stops
            ?.map(s => ({ name: s.stop?.name, position: s.stopPosition })) || []
        })) || []
      }));

      setCachedNearbyStops(lat, lon, radius, compressedResult);

      // Remove from in-flight tracking
      inFlightRequests.delete(cacheKey);

      return result;

    } catch (error) {
      // Remove from in-flight tracking
      inFlightRequests.delete(cacheKey);

      console.error('Error fetching nearby stops:', error);

      // If we have stale cache, return it instead of failing
      if (staleCache) {
        console.warn('⚠️ Using stale cache data due to network error', {
          staleStopsCount: staleCache.length,
          error: error.message
        });
        return staleCache;
      }

      console.error('❌ No stale cache available, throwing error');
      throw error;
    }
  })();

  // Store the promise so duplicate requests can wait for it
  inFlightRequests.set(cacheKey, requestPromise);

  return requestPromise;
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
 * Get a specific stop by its GTFS ID with departure times
 * @param {string} gtfsId - The GTFS ID of the stop (e.g., "Viro:7820134-1")
 * @returns {Promise<Object|null>} Stop object with departures, or null if not found
 */
export async function getStopById(gtfsId) {
  const graphqlQuery = `
    query GetStop($id: String!) {
      stop(id: $id) {
        gtfsId
        name
        code
        lat
        lon
        stoptimesWithoutPatterns(numberOfDepartures: 20, omitCanceled: false) {
          scheduledArrival
          scheduledDeparture
          headsign
          stopPosition
          trip {
            route {
              shortName
              longName
              gtfsId
            }
            stoptimes {
              stop {
                gtfsId
                name
              }
              stopPosition
            }
          }
        }
      }
    }
  `;

  try {
    const data = await query(graphqlQuery, { id: gtfsId });
    return data.stop;
  } catch (error) {
    console.error(`Error fetching stop ${gtfsId}:`, error);
    return null;
  }
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
 * Get the next stop name from a stoptime object
 * @param {Object} stoptime - Stoptime object with trip.stoptimes data
 * @returns {string|null} - Name of the next stop, or null if not available
 */
export function getNextStopName(stoptime) {
  try {
    if (!stoptime?.trip?.stoptimes || !Array.isArray(stoptime.trip.stoptimes)) {
      return null;
    }

    const currentStopPosition = stoptime.stopPosition;
    if (currentStopPosition === undefined || currentStopPosition === null) {
      return null;
    }

    // Find the next stop in the sequence
    const nextStop = stoptime.trip.stoptimes.find(
      st => st.stopPosition === currentStopPosition + 1
    );

    return nextStop?.stop?.name || null;
  } catch (error) {
    console.warn('Error getting next stop name:', error);
    return null;
  }
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
// Departure times - cache for 2 minutes (fresh enough, provides offline resilience)
const STOPS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
// Limit number of cached location queries (keep 10 most recent for good offline UX)
const MAX_STOPS_CACHE_ENTRIES = 10; // Reduced to prevent quota issues

// In-memory cache for all routes (loaded from bundled JSON file)
let allRoutesCache = null;
let allRoutesFetchPromise = null;

// Load routes from bundled JSON file
async function loadRoutesFromBundle() {
  if (allRoutesCache) {
    return allRoutesCache;
  }

  if (allRoutesFetchPromise) {
    return allRoutesFetchPromise;
  }

  console.log('📦 Loading routes from bundled data...');

  allRoutesFetchPromise = fetch('/Tartubus/data/routes.min.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load routes: ${response.status}`);
      }
      return response.json();
    })
    .then(routes => {
      allRoutesCache = routes;
      allRoutesFetchPromise = null;
      console.log(`✅ Loaded ${routes.length} routes from bundle (instant)`);
      return routes;
    })
    .catch(error => {
      allRoutesFetchPromise = null;
      console.error('Failed to load bundled routes:', error);
      throw error;
    });

  return allRoutesFetchPromise;
}


// In-flight request tracking to prevent duplicate requests
const inFlightRequests = new Map();

// Debug function to show cache usage
function showCacheDebugInfo() {
  console.log('🔍 === CACHE DEBUG INFO ===');

  let totalSize = 0;
  const cacheInfo = [];

  // Check all localStorage items
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    const sizeKB = (value.length * 2) / 1024; // UTF-16 = 2 bytes per char
    totalSize += sizeKB;

    // Parse cache data to show details
    let details = '';
    try {
      const parsed = JSON.parse(value);
      if (key.startsWith('stops_')) {
        const age = Math.round((Date.now() - parsed.timestamp) / 1000 / 60);
        details = `${parsed.data.length} stops, age: ${age}m, expires in: ${Math.round((STOPS_CACHE_DURATION - (Date.now() - parsed.timestamp)) / 1000 / 60)}m`;
      } else if (key.startsWith('route_')) {
        const age = Math.round((Date.now() - parsed.timestamp) / 1000 / 60 / 60);
        details = `route geometry, age: ${age}h`;
      } else if (key === 'tartu_bus_favorites') {
        const favs = Array.isArray(parsed) ? parsed : [];
        details = `${favs.length} favorite stops`;
      } else if (key === 'settings') {
        details = `user settings`;
      } else if (key === 'darkMode') {
        details = `dark mode: ${parsed}`;
      }
    } catch (e) {
      details = 'unknown format';
    }

    cacheInfo.push({
      key,
      sizeMB: (sizeKB / 1024).toFixed(2),
      sizeKB: sizeKB.toFixed(2),
      details
    });
  }

  // Sort by size (largest first)
  cacheInfo.sort((a, b) => parseFloat(b.sizeMB) - parseFloat(a.sizeMB));

  console.table(cacheInfo);
  console.log(`📦 Total cache size: ${(totalSize / 1024).toFixed(2)} MB (${totalSize.toFixed(2)} KB)`);
  console.log(`📊 localStorage quota: ~5-10 MB (browser dependent)`);
  console.log(`💾 Used: ${((totalSize / 1024) / 10 * 100).toFixed(1)}% (assuming 10MB quota)`);

  // In-memory caches
  console.log('\n🧠 In-Memory Caches (session only):');
  console.log(`  - allRoutesCache: ${allRoutesCache ? `${allRoutesCache.length} routes` : 'not loaded'}`);
  console.log(`  - inFlightRequests: ${inFlightRequests.size} active`);

  console.log('\n💡 Tip: Clear old caches with: localStorage.clear()');
  console.log('======================\n');
}

// Expose debug function globally
window.showCacheDebug = showCacheDebugInfo;

/**
 * Initialize caches on app startup
 * This cleans up old cached data and handles version changes
 */
export function initializeCaches() {
  console.log('🚀 Initializing caches...');

  // One-time migration flags for cache clear
  // Soft clear: Clears cache but preserves favorites, settings, dark mode, language
  // Full clear: Clears EVERYTHING including favorites (nuclear option)
  const SOFT_CLEAR_VERSION = 'v1.1-soft-clear';
  const FULL_CLEAR_VERSION = 'v1.1-full-clear'; // Full wipe - clears everything including favorites
  const SOFT_CLEAR_KEY = 'cache_soft_clear_version';
  const FULL_CLEAR_KEY = 'cache_full_clear_version';

  // Use build hash that changes on every build/deployment
  const APP_BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev';
  const BUILD_HASH_KEY = 'app_build_hash';
  const PRESERVE_KEYS_SOFT = [
    'tartu_bus_favorites',      // User's favorite stops
    'tartu-bus-settings',       // User settings (radius, max stops, etc)
    'darkMode',                 // Dark mode preference
    'i18nextLng',               // Language preference
    BUILD_HASH_KEY,             // Build hash tracking
    SOFT_CLEAR_KEY,             // Soft clear version tracking
    FULL_CLEAR_KEY              // Full clear version tracking
  ];

  try {
    // Check for FULL CLEAR first (nuclear option - wipes everything)
    const storedFullClear = localStorage.getItem(FULL_CLEAR_KEY);
    const needsFullClear = FULL_CLEAR_VERSION !== 'never' && storedFullClear !== FULL_CLEAR_VERSION;

    if (needsFullClear) {
      console.warn(`💥 FULL CACHE CLEAR triggered (${storedFullClear || 'first'} → ${FULL_CLEAR_VERSION})`);
      console.warn('⚠️  This will delete EVERYTHING including favorites!');

      // Nuclear option - clear absolutely everything
      localStorage.clear();

      // Only set the full clear flag so it doesn't happen again
      localStorage.setItem(FULL_CLEAR_KEY, FULL_CLEAR_VERSION);
      localStorage.setItem(BUILD_HASH_KEY, APP_BUILD_HASH);

      console.log('💥 Full cache clear complete - all user data removed');
    } else {
      // Check for SOFT CLEAR (preserves user preferences)
      const storedSoftClear = localStorage.getItem(SOFT_CLEAR_KEY);
      const needsSoftClear = storedSoftClear !== SOFT_CLEAR_VERSION;

      if (needsSoftClear) {
        console.log(`🧹 Soft cache clear needed (${storedSoftClear || 'first load'} → ${SOFT_CLEAR_VERSION})`);

        // Store important data temporarily
        const preserved = {};
        PRESERVE_KEYS_SOFT.forEach(key => {
          const value = localStorage.getItem(key);
          if (value !== null) {
            preserved[key] = value;
          }
        });

        // Clear everything
        localStorage.clear();

        // Restore preserved data
        Object.entries(preserved).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });

        // Set soft clear flag so this doesn't happen again
        localStorage.setItem(SOFT_CLEAR_KEY, SOFT_CLEAR_VERSION);

        // Also update build hash
        localStorage.setItem(BUILD_HASH_KEY, APP_BUILD_HASH);

        console.log(`✅ Soft cache clear complete, preserved ${Object.keys(preserved).length} important items`);
      } else {
        // No migration needed, just update build hash for tracking
        localStorage.setItem(BUILD_HASH_KEY, APP_BUILD_HASH);
      }
    }

    // Always clean temporary cache on startup
    console.log('🧹 Clearing temporary cache (stops & routes)...');

    const keysToRemove = [];

    // Remove cache entries - routes are now bundled, stops are time-sensitive
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      // Clear stops and route cache on every page reload
      if (key && (key.startsWith('stops_') || key.startsWith('route_'))) {
        keysToRemove.push(key);
      }
    }

    // Remove marked entries
    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log(`🗑️ Cleared ${keysToRemove.length} temporary cache entries`);
    }

    // Also clean up any old/expired entries
    clearOldCacheEntries();
  } catch (error) {
    console.error('Error during cache initialization:', error);
  }

  console.log(`✅ Cache initialization complete`);
}

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
      // Cache expired but don't remove it yet - might be useful as fallback
      console.log(`⏰ Cache expired for ${cacheType}, will fetch fresh data`);
      return null;
    }
  } catch (error) {
    console.warn(`Error reading ${cacheType} cache:`, error);
    return null;
  }
}

/**
 * Get stale cache data (expired but still in localStorage) as fallback
 */
function getStaleCache(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) {
      console.log(`📦 No stale cache found for ${cacheKey}`);
      return null;
    }

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    const ageMinutes = Math.round(age / 60000);

    if (data && Array.isArray(data)) {
      console.log(`📦 Found stale cache (age: ${ageMinutes}m, ${data.length} stops) - will use as fallback if needed`);
      return data;
    } else {
      console.warn(`📦 Stale cache exists but data is invalid:`, typeof data);
      return null;
    }
  } catch (error) {
    console.warn(`📦 Error reading stale cache:`, error);
    return null;
  }
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCacheEntries() {
  try {
    const now = Date.now();
    const keysToRemove = [];
    const stopsCacheEntries = [];

    // Find all expired cache entries and collect stops entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      // Only process our cache keys (route_ and stops_ prefixed)
      if (key && key.startsWith('stops_')) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            const age = now - timestamp;

            // Remove if older than cache duration
            if (age > STOPS_CACHE_DURATION) {
              keysToRemove.push(key);
            } else {
              // Track valid stops cache entries for LRU eviction
              stopsCacheEntries.push({ key, timestamp });
            }
          }
        } catch (e) {
          // If we can't parse it, remove it
          keysToRemove.push(key);
        }
      }
    }

    // LRU: If we have too many stops cache entries, remove oldest ones
    if (stopsCacheEntries.length > MAX_STOPS_CACHE_ENTRIES) {
      // Sort by timestamp (oldest first)
      stopsCacheEntries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest entries beyond the limit
      const toRemove = stopsCacheEntries.length - MAX_STOPS_CACHE_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        keysToRemove.push(stopsCacheEntries[i].key);
      }
    }

    // Remove all marked entries
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned ${keysToRemove.length} cache entries (expired or over limit)`);
    }
    return keysToRemove.length;
  } catch (error) {
    console.warn('Error cleaning cache:', error);
    return 0;
  }
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
    // If quota exceeded, try cleaning old cache and retry once
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ Storage quota exceeded, cleaning old cache...');
      const cleaned = clearOldCacheEntries();

      if (cleaned > 0) {
        // Try again after cleaning
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
          console.log('✅ Cache write succeeded after cleanup');
        } catch (retryError) {
          console.warn('❌ Cache write failed even after cleanup. App will continue without caching this data.');
        }
      } else {
        console.warn('❌ No old cache to clean. App will continue without caching this data.');
      }
    } else {
      console.warn('Error writing cache:', error);
    }
  }
}

/**
 * Get cached nearby stops data
 */
function getCachedNearbyStops(lat, lon, radius) {
  // Round coordinates to ~1km grid to reduce cache entries
  // (0.01 degrees ≈ 1.1km at Tartu's latitude)
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const cacheKey = `stops_${roundedLat}_${roundedLon}_${radius}`;
  return getCachedData(cacheKey, STOPS_CACHE_DURATION, 'stops');
}

/**
 * Save nearby stops data to cache
 */
function setCachedNearbyStops(lat, lon, radius, data) {
  // Round coordinates to ~1km grid to reduce cache entries
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const cacheKey = `stops_${roundedLat}_${roundedLon}_${radius}`;
  setCachedData(cacheKey, data);
}

/**
 * Get all stops for specific routes by route short names with proper geometry
 * @param {string[]} routeShortNames - Array of route numbers to fetch
 * @param {Object} cityBounds - Optional city bounds to limit query area {lat, lon, radius}
 */
export async function getStopsByRoutes(routeShortNames, cityBounds = null) {
  console.log('🔄 Loading route data from bundle for:', routeShortNames, cityBounds ? `in ${cityBounds.radius}m radius` : '');

  // Helper function to calculate distance
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Load routes from bundled JSON file (fast!)
  await loadRoutesFromBundle();

  try {
    // Filter by shortName
    let selectedRoutes = allRoutesCache.filter(route =>
      routeShortNames.includes(route.shortName)
    );

    console.log(`📍 Found ${selectedRoutes.length} routes matching ${routeShortNames.join(', ')}`);

    // If we have city bounds, filter routes that have stops in the area
    if (cityBounds && selectedRoutes.length > 0) {
      selectedRoutes = selectedRoutes.filter(route => {
        // Check if any pattern has stops within city bounds
        return route.patterns?.some(pattern =>
          pattern.stops?.some(stop => {
            const distance = getDistance(
              cityBounds.lat, cityBounds.lon,
              stop.lat, stop.lon
            );
            return distance <= cityBounds.radius;
          })
        );
      });

      console.log(`✅ Filtered to ${selectedRoutes.length} routes in ${cityBounds.radius/1000}km radius`);
    }

    // Collect all unique stops and their patterns
    const stopsMap = new Map();
    const routePatterns = [];

    selectedRoutes.forEach(route => {
      // Group patterns by direction - try to detect opposite directions
      const patternsByDirection = new Map();

      // Helper function to check if two patterns are going in opposite directions
      const areOppositeDirections = (pattern1, pattern2) => {
        const stops1 = pattern1.stops.map(s => s.gtfsId);
        const stops2 = pattern2.stops.map(s => s.gtfsId);

        // Check if stops overlap significantly in reverse order
        const minLength = Math.min(stops1.length, stops2.length);
        const checkLength = Math.floor(minLength * 0.5); // Check 50% of stops

        if (checkLength < 3) return false; // Need at least 3 stops to compare

        let reverseMatches = 0;
        for (let i = 0; i < checkLength; i++) {
          // Compare stops from the beginning of pattern1 with stops from the end of pattern2
          if (stops1[i] === stops2[stops2.length - 1 - i]) {
            reverseMatches++;
          }
        }

        // If at least 60% of checked stops match in reverse, it's the opposite direction
        return (reverseMatches / checkLength) >= 0.6;
      };

      route.patterns?.forEach(pattern => {
        if (!pattern.stops || pattern.stops.length === 0) return;

        // Use directionId if valid (>= 0), otherwise try to infer from route geometry
        let dir = (pattern.directionId >= 0) ? pattern.directionId : null;

        if (dir === null) {
          // Invalid directionId - try to detect by comparing with existing patterns
          let foundDirection = false;

          for (const [existingDir, existingPattern] of patternsByDirection.entries()) {
            if (areOppositeDirections(pattern, existingPattern)) {
              // This pattern goes opposite to the existing one
              dir = existingDir === 0 ? 1 : 0;
              foundDirection = true;
              break;
            } else {
              // Check if it's the same direction (similar route)
              const stops1 = pattern.stops.map(s => s.gtfsId);
              const stops2 = existingPattern.stops.map(s => s.gtfsId);
              const minLength = Math.min(stops1.length, stops2.length);
              const checkLength = Math.floor(minLength * 0.5);

              let sameDirectionMatches = 0;
              for (let i = 0; i < checkLength; i++) {
                if (stops1[i] === stops2[i]) {
                  sameDirectionMatches++;
                }
              }

              // If at least 60% match in same order, it's the same direction
              if (checkLength >= 3 && (sameDirectionMatches / checkLength) >= 0.6) {
                dir = existingDir;
                foundDirection = true;
                break;
              }
            }
          }

          // If still not assigned, assign next available direction (0 or 1)
          if (dir === null) {
            dir = patternsByDirection.has(0) ? 1 : 0;
          }
        }

        // Only keep the longest pattern for each direction
        if (!patternsByDirection.has(dir) ||
            (pattern.stops?.length || 0) > (patternsByDirection.get(dir).stops?.length || 0)) {
          patternsByDirection.set(dir, pattern);
        }
      });

      console.log(`Route ${route.shortName}: Found ${patternsByDirection.size} directions`,
        Array.from(patternsByDirection.entries()).map(([dir, p]) => ({
          dir,
          headsign: p.headsign,
          stops: p.stops.length,
          firstStop: p.stops[0]?.name,
          lastStop: p.stops[p.stops.length - 1]?.name
        })));

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

    // No need to cache - routes are already bundled and in-memory cached
    return result;
  } catch (error) {
    console.error('Error fetching stops by routes:', error);
    throw error;
  }
}
