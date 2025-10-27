import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFavorites } from '../hooks/useFavorites';
import { getNearbyStops, getStopsByRoutes } from '../services/digitransit';
import { getSetting } from '../utils/settings';
import CountdownTimer from './CountdownTimer';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom stop marker icons - bus stop sign style
const createStopIcon = (color) => {
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="25" width="6" height="25" fill="${color}"/>
        <circle cx="20" cy="15" r="14" fill="${color}" stroke="white" stroke-width="3"/>
        <rect x="12" y="10" width="16" height="10" rx="2" fill="white"/>
        <rect x="13.5" y="12" width="5" height="4" fill="${color}"/>
        <rect x="21.5" y="12" width="5" height="4" fill="${color}"/>
        <circle cx="15.5" cy="19" r="1.5" fill="${color}"/>
        <circle cx="24.5" cy="19" r="1.5" fill="${color}"/>
      </svg>
    `),
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
    className: '', // Remove any default classes
  });
};

const stopIcon = createStopIcon('#6B7280'); // Gray for regular stops (not on filtered routes)
const nearbyStopIcon = createStopIcon('#6B7280'); // Gray for nearby stops when no filter
const selectedStopIcon = createStopIcon('#EF4444'); // Red for selected stop from Near Me

// Component to update map view when location changes
function LocationMarker({ position, onLocationUpdate, mapRef }) {
  const map = useMap();
  const hasZoomedRef = useRef(false);

  // Store map reference
  useEffect(() => {
    if (mapRef) {
      mapRef.current = map;
    }
  }, [map, mapRef]);

  useEffect(() => {
    if (position) {
      // Only zoom to location on first update, not continuous tracking updates
      if (!hasZoomedRef.current) {
        map.setView([position.lat, position.lon], 15);
        hasZoomedRef.current = true;
      }

      // Load stops around new location (but don't zoom)
      if (onLocationUpdate) {
        onLocationUpdate(position.lat, position.lon);
      }
    }
  }, [position, map]);

  if (!position) return null;

  return (
    <Marker position={[position.lat, position.lon]}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

// Component to handle map events (zoom, pan)
function MapEventHandler({ onMapMove }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onMapMove(center.lat, center.lng, zoom);
    },
    zoomend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onMapMove(center.lat, center.lng, zoom);
    },
  });
  return null;
}

// Component to add arrow decorators to polylines
function RouteLineWithArrows({ positions, color, headsign, routeName, stopCount }) {
  const map = useMap();
  const decoratorRef = useRef(null);
  const polylineRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    if (!map || positions.length === 0) {
      return;
    }

    // Create shadow/outline polyline (wider, white/dark)
    const shadow = L.polyline(positions, {
      color: '#FFFFFF',
      weight: 7,
      opacity: 0.9,
    }).addTo(map);

    shadowRef.current = shadow;

    // Create main polyline on top
    const polyline = L.polyline(positions, {
      color: color,
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    polylineRef.current = polyline;

    // Add arrow decorators
    const decorator = L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: '5%',
          repeat: 100, // pixels between arrows
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            pathOptions: {
              stroke: true,
              weight: 2,
              color: color,
              opacity: 0.8,
            }
          })
        }
      ]
    }).addTo(map);

    decoratorRef.current = decorator;

    // Add popup to polyline
    polyline.bindPopup(`
      <div class="text-sm">
        <div class="font-bold" style="color: ${color}">Route ${routeName}</div>
        <div class="text-gray-700 font-semibold">→ ${headsign}</div>
        <div class="text-xs text-gray-500 mt-1">${stopCount} stops</div>
      </div>
    `);

    // Cleanup
    return () => {
      if (decoratorRef.current) {
        map.removeLayer(decoratorRef.current);
      }
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
      }
      if (shadowRef.current) {
        map.removeLayer(shadowRef.current);
      }
    };
  }, [map, positions, color, headsign, routeName, stopCount]);

  return null;
}

function StopFinder({ isDarkMode, selectedStop: highlightedStop }) {
  const { location, getLocation, startWatching, stopWatching, watching } = useGeolocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [stops, setStops] = useState([]);
  const [nearbyStopIds, setNearbyStopIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);
  const [error, setError] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [selectedRoutes, setSelectedRoutes] = useState(new Set());
  const [showRouteFilter, setShowRouteFilter] = useState(false);
  const [routeStops, setRouteStops] = useState([]);
  const [routePatterns, setRoutePatterns] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [locationMessage, setLocationMessage] = useState(null);
  const mapRef = useRef(null);
  const moveTimeoutRef = useRef(null);
  const lastMovePositionRef = useRef(null);

  // Default to Tartu center
  const defaultCenter = { lat: 58.3776, lon: 26.7290 };
  const center = location.lat ? location : defaultCenter;

  // Load stops around the center on mount and auto-request location
  useEffect(() => {
    // Auto-request location on startup and start watching for movement
    getLocation();
    startWatching();

    // Load initial stops (will be updated when location arrives)
    loadStops(center.lat, center.lon, currentZoom);

    // Cleanup: stop watching and clear timeout when component unmounts
    return () => {
      stopWatching();
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
    };
  }, []);

  // Update stops when location is received
  useEffect(() => {
    if (location.lat && location.lon) {
      loadStops(location.lat, location.lon, currentZoom, true);
    }
  }, [location.lat, location.lon]);

  // Center map on highlighted stop when navigating from Near Me
  useEffect(() => {
    if (highlightedStop && mapRef.current) {
      // Center on stop and zoom in
      mapRef.current.setView([highlightedStop.lat, highlightedStop.lon], 16);
      // Set as selected stop to show popup
      setSelectedStop(highlightedStop);
    }
  }, [highlightedStop]);

  // Auto-refresh departure times every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      // Refresh stops data silently (without showing loading indicator)
      const currentLat = location.lat || defaultCenter.lat;
      const currentLon = location.lon || defaultCenter.lon;
      loadStops(currentLat, currentLon, currentZoom);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, location.lat, location.lon, currentZoom]);

  // Calculate radius based on zoom level
  const getRadiusForZoom = (zoom) => {
    // More zoomed out = larger radius
    if (zoom <= 11) return 5000;      // 5km
    if (zoom <= 12) return 3000;      // 3km
    if (zoom <= 13) return 2000;      // 2km
    if (zoom <= 14) return 1500;      // 1.5km
    return 1000;                       // 1km for zoom 15+
  };

  const loadStops = async (lat, lon, zoom = 13, includeUserLocation = false) => {
    setLoading(true);
    setError(null);
    try {
      const radius = getRadiusForZoom(zoom);
      const mapCenterStops = await getNearbyStops(lat, lon, radius);

      // If user has a location and we're not already loading from their location,
      // also load stops near the user
      let allStops = mapCenterStops;
      const nearbyIds = new Set();

      if (location.lat && location.lon && !includeUserLocation) {
        const userRadius = getSetting('nearbyRadius') || 500;
        const userLocationStops = await getNearbyStops(location.lat, location.lon, userRadius);

        // Track which stops are nearby
        userLocationStops.forEach(stop => nearbyIds.add(stop.gtfsId));

        // Merge and deduplicate stops by gtfsId
        const stopMap = new Map();
        [...mapCenterStops, ...userLocationStops].forEach(stop => {
          stopMap.set(stop.gtfsId, stop);
        });
        allStops = Array.from(stopMap.values());
      }

      setStops(allStops);
      setNearbyStopIds(nearbyIds);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Error loading stops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    // Clear nearby stops cache to force fresh data
    const nearbyRadius = getSetting('nearbyRadius') || 500;
    if (location.lat && location.lon) {
      loadStops(location.lat, location.lon, currentZoom);
    } else {
      loadStops(center.lat, center.lon, currentZoom);
    }
  };

  const handleMapMove = (lat, lon, zoom) => {
    setCurrentZoom(zoom);

    // Clear any pending timeout
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }

    // Check if we've moved significantly since last load
    const lastPos = lastMovePositionRef.current;
    if (lastPos) {
      const latDiff = Math.abs(lat - lastPos.lat);
      const lonDiff = Math.abs(lon - lastPos.lon);
      const zoomDiff = Math.abs(zoom - lastPos.zoom);

      // Thresholds: 0.01° = ~1.1km, zoom change of 1 level
      // Only reload if we've moved significantly OR zoomed
      if (latDiff < 0.01 && lonDiff < 0.01 && zoomDiff < 1) {
        return; // Movement too small, skip reload
      }
    }

    // Debounce: wait 500ms after map stops moving before loading
    moveTimeoutRef.current = setTimeout(() => {
      lastMovePositionRef.current = { lat, lon, zoom };
      loadStops(lat, lon, zoom);
    }, 500);
  };

  const handleLocationUpdate = (lat, lon) => {
    loadStops(lat, lon, currentZoom, true);
  };

  const handleToggleLocationTracking = () => {
    if (watching) {
      stopWatching();
      setLocationMessage('Location tracking stopped');
    } else {
      getLocation();
      startWatching();
      setLocationMessage('Location tracking started');

      // Center map on current location if available
      if (location.lat && location.lon && mapRef.current) {
        mapRef.current.setView([location.lat, location.lon], 15);
      }
    }

    // Auto-hide message after 2 seconds
    setTimeout(() => setLocationMessage(null), 2000);
  };

  // Add offset to prevent overlapping markers - deterministic based on stop ID
  const adjustStopPositions = (stops, zoom) => {
    // Calculate offset based on zoom level - keep offsets small to stay close to roads
    const baseOffset = zoom >= 16 ? 0.00015 : // ~17 meters at high zoom
                       zoom >= 14 ? 0.00012 : // ~13 meters at medium zoom
                       0.0001; // ~11 meters at low zoom

    // Minimum distance in degrees to consider stops as "overlapping" (visually)
    const minDistance = zoom >= 16 ? 0.0003 : 0.00025;

    // Sort stops by ID to ensure consistent ordering
    const sortedStops = [...stops].sort((a, b) => a.gtfsId.localeCompare(b.gtfsId));
    const adjustedStops = [];

    sortedStops.forEach((stop, index) => {
      let adjustedLat = stop.lat;
      let adjustedLon = stop.lon;

      // Check if this stop is too close to any previously adjusted stop
      for (let i = 0; i < adjustedStops.length; i++) {
        const other = adjustedStops[i];
        const latDiff = adjustedLat - other.adjustedLat;
        const lonDiff = adjustedLon - other.adjustedLon;
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

        if (distance < minDistance && distance > 0.00001) {
          // Too close, offset along the line between them (like stops in a queue)
          // This keeps them roughly on the same side of the road
          const angle = Math.atan2(latDiff, lonDiff);

          // Push the new stop away from the existing one
          adjustedLat = stop.lat + Math.sin(angle) * baseOffset;
          adjustedLon = stop.lon + Math.cos(angle) * baseOffset;
          break; // Only adjust once per stop
        }
      }

      adjustedStops.push({
        ...stop,
        adjustedLat,
        adjustedLon,
      });
    });

    return adjustedStops;
  };

  // Combine regular stops with route-specific stops
  const allStopsToShow = selectedRoutes.size > 0
    ? [...stops, ...routeStops]
    : stops;

  // Deduplicate by gtfsId
  const uniqueStops = Array.from(
    new Map(allStopsToShow.map(stop => [stop.gtfsId, stop])).values()
  );

  const adjustedStops = adjustStopPositions(uniqueStops, currentZoom);

  // Get all unique routes from all stops
  const allRoutes = new Set();
  stops.forEach(stop => {
    if (stop.stoptimesWithoutPatterns) {
      stop.stoptimesWithoutPatterns.forEach(departure => {
        const routeName = departure.trip?.route?.shortName;
        if (routeName) {
          allRoutes.add(routeName);
        }
      });
    }
  });
  const sortedRoutes = Array.from(allRoutes).sort((a, b) => {
    // Sort numerically if both are numbers, otherwise alphabetically
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.localeCompare(b);
  });

  // Create a map of stop IDs to their route patterns (for showing direction info)
  const stopToPatterns = new Map();
  routePatterns.forEach(pattern => {
    pattern.stops.forEach(stop => {
      if (!stopToPatterns.has(stop.gtfsId)) {
        stopToPatterns.set(stop.gtfsId, []);
      }
      stopToPatterns.get(stop.gtfsId).push({
        routeShortName: pattern.routeShortName,
        headsign: pattern.headsign,
        directionId: pattern.directionId
      });
    });
  });

  // Filter stops by selected routes
  let filteredStops = selectedRoutes.size === 0 ? adjustedStops : adjustedStops.filter(stop => {
    // If this stop is part of a selected route pattern, always include it
    if (stopToPatterns.has(stop.gtfsId)) {
      return true;
    }

    // Otherwise check if it has departures for selected routes
    if (!stop.stoptimesWithoutPatterns) return false;
    return stop.stoptimesWithoutPatterns.some(departure => {
      const routeName = departure.trip?.route?.shortName;
      return routeName && selectedRoutes.has(routeName);
    });
  });

  // Limit number of stops based on setting
  const maxStops = getSetting('maxStopsOnMap') || 100;
  const stopsLimitExceeded = filteredStops.length > maxStops;
  if (stopsLimitExceeded) {
    // Prioritize nearby stops, then closest to map center
    filteredStops = filteredStops
      .sort((a, b) => {
        const aIsNearby = nearbyStopIds.has(a.gtfsId);
        const bIsNearby = nearbyStopIds.has(b.gtfsId);
        if (aIsNearby && !bIsNearby) return -1;
        if (!aIsNearby && bIsNearby) return 1;

        // If both or neither are nearby, sort by distance to map center
        const aDist = Math.sqrt(Math.pow(a.lat - center.lat, 2) + Math.pow(a.lon - center.lon, 2));
        const bDist = Math.sqrt(Math.pow(b.lat - center.lat, 2) + Math.pow(b.lon - center.lon, 2));
        return aDist - bDist;
      })
      .slice(0, maxStops);
  }

  const toggleRoute = (route) => {
    const newRoutes = new Set(selectedRoutes);
    if (newRoutes.has(route)) {
      newRoutes.delete(route);
    } else {
      newRoutes.add(route);
    }
    setSelectedRoutes(newRoutes);
  };

  const clearFilters = () => {
    setSelectedRoutes(new Set());
    setRouteStops([]);
    setRoutePatterns([]);
  };

  // Format time ago
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastUpdated) {
        setTimeAgo('');
        return;
      }
      const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
      if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
          setTimeAgo(`${minutes}m ago`);
        } else {
          const hours = Math.floor(minutes / 60);
          setTimeAgo(`${hours}h ago`);
        }
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000); // Update every second

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Load all stops for selected routes
  useEffect(() => {
    const loadRouteStops = async () => {
      if (selectedRoutes.size > 0) {
        setLoadingRoutes(true);
        try {
          const routeNames = Array.from(selectedRoutes);
          const { stops: routeStopsData, routePatterns: patterns } = await getStopsByRoutes(routeNames);
          setRouteStops(routeStopsData);
          setRoutePatterns(patterns);
        } catch (err) {
          console.error('Error loading route stops:', err);
        } finally {
          setLoadingRoutes(false);
        }
      } else {
        setRouteStops([]);
        setRoutePatterns([]);
        setLoadingRoutes(false);
      }
    };

    loadRouteStops();
  }, [selectedRoutes]);

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={13}
        className="w-full h-full"
        zoomControl={true}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          maxNativeZoom={18}
          className={isDarkMode ? 'map-tiles-dark' : ''}
        />

        {/* Map event handler */}
        <MapEventHandler onMapMove={handleMapMove} />

        {/* User location marker */}
        {location.lat && <LocationMarker position={location} onLocationUpdate={handleLocationUpdate} mapRef={mapRef} />}

        {/* Route lines with direction arrows */}
        {routePatterns.map((pattern, idx) => {
          // Use the coordinates from geometry (which follow roads)
          const positions = pattern.coordinates && pattern.coordinates.length > 0
            ? pattern.coordinates
            : pattern.stops.map(stop => [stop.lat, stop.lon]);

          // Use different colors for different directions
          // Direction 0: Blue, Direction 1: Yellow (Ukraine colors 🇺🇦)
          const colors = ['#0066CC', '#FBBF24', '#10B981', '#F59E0B'];
          // Handle negative, null, or undefined directionIds
          const dirId = (pattern.directionId >= 0) ? pattern.directionId : 0;
          const lineColor = colors[dirId % colors.length];

          return (
            <RouteLineWithArrows
              key={`pattern-${idx}`}
              positions={positions}
              color={lineColor}
              headsign={pattern.headsign}
              routeName={pattern.routeShortName}
              stopCount={pattern.stops.length}
            />
          );
        })}

        {/* Stop markers with offset to prevent overlap */}
        {filteredStops.map((stop, idx) => {
          const isNearby = nearbyStopIds.has(stop.gtfsId);
          const isHighlighted = highlightedStop && stop.gtfsId === highlightedStop.gtfsId;

          // Determine marker color based on route patterns
          let iconColor = '#6B7280'; // Default gray

          // Highlighted stop from Near Me gets red color (highest priority)
          if (isHighlighted) {
            iconColor = '#EF4444'; // Red for highlighted stop
          } else if (stopToPatterns.has(stop.gtfsId)) {
            const patterns = stopToPatterns.get(stop.gtfsId);
            // Use the color of the first pattern at this stop
            // Direction 0: Blue, Direction 1: Yellow (Ukraine colors 🇺🇦)
            const colors = ['#0066CC', '#FBBF24', '#10B981', '#F59E0B'];
            const dirId = (patterns[0].directionId >= 0) ? patterns[0].directionId : 0;
            iconColor = colors[dirId % colors.length];
          } else if (isNearby) {
            // Nearby but not on filtered route: green
            iconColor = '#10B981';
          }

          const markerIcon = createStopIcon(iconColor);

          return (
            <Marker
              key={stop.gtfsId}
              position={[stop.adjustedLat, stop.adjustedLon]}
              icon={markerIcon}
            >
              <Popup maxWidth={300} autoPan={false} closeOnClick={false}>
                <div className="p-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-lg mb-1">{stop.name}</h3>
                      <p className="text-sm text-gray-600">Stop {stop.code}</p>
                    </div>
                    <button
                      onClick={() => toggleFavorite(stop)}
                      className={`p-2 rounded-lg transition-colors ${
                        isFavorite(stop.gtfsId)
                          ? 'text-yellow-500 hover:text-yellow-600'
                          : 'text-gray-400 hover:text-yellow-500'
                      }`}
                      title={isFavorite(stop.gtfsId) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg className="w-6 h-6" fill={isFavorite(stop.gtfsId) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>

                  {/* Show route directions if filtered */}
                  {stopToPatterns.has(stop.gtfsId) && (
                    <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="font-semibold text-xs text-gray-700 mb-1">Routes at this stop:</p>
                      {stopToPatterns.get(stop.gtfsId).map((pattern, patternIdx) => {
                        // Direction 0: Blue, Direction 1: Yellow (Ukraine colors 🇺🇦)
                        const colors = ['#0066CC', '#FBBF24', '#10B981', '#F59E0B'];
                        const dirId = (pattern.directionId >= 0) ? pattern.directionId : 0;
                        const lineColor = colors[dirId % colors.length];
                        return (
                          <div key={patternIdx} className="text-xs mb-1 flex items-center gap-1">
                            <span
                              className="font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: lineColor }}
                            >
                              {pattern.routeShortName}
                            </span>
                            <span className="text-gray-600">→ {pattern.headsign}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Next departures */}
                  {stop.stoptimesWithoutPatterns && stop.stoptimesWithoutPatterns.length > 0 ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">Next buses:</p>
                      {stop.stoptimesWithoutPatterns.slice(0, 3).map((departure, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold text-xs">
                              {departure.trip?.route?.shortName || '?'}
                            </span>
                            <span className="text-gray-700 text-xs">
                              {departure.headsign || 'Unknown'}
                            </span>
                          </div>
                          <span className="font-semibold text-xs">
                            <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No upcoming departures</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Top controls - Route filter */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setShowRouteFilter(!showRouteFilter)}
          className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 justify-center border border-gray-200 dark:border-gray-700 ${selectedRoutes.size > 0 ? 'ring-2 ring-primary dark:ring-blue-400' : ''}`}
        >
          <span className="text-lg">🚌</span>
          Filter Routes {selectedRoutes.size > 0 ? `(${selectedRoutes.size})` : ''}
        </button>

        {/* Route filter dropdown */}
        {showRouteFilter && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Filter by Route</h3>
              {selectedRoutes.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {sortedRoutes.map(route => (
                <button
                  key={route}
                  onClick={() => toggleRoute(route)}
                  className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${
                    selectedRoutes.has(route)
                      ? 'bg-primary dark:bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {route}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading indicator for map stops */}
        {loading && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-center border border-gray-200 dark:border-gray-700">
            Loading stops...
          </div>
        )}

        {/* Loading indicator for route data */}
        {loadingRoutes && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shadow-lg rounded-lg px-4 py-3 text-sm text-blue-700 dark:text-blue-400 text-center flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading route...</span>
          </div>
        )}

        {/* Stop count */}
        {!loading && stops.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-2 text-xs text-gray-600 dark:text-gray-300 text-center border border-gray-200 dark:border-gray-700">
            Showing {filteredStops.length} of {stops.length} stops
            {selectedRoutes.size > 0 && ` (filtered)`}
            {stopsLimitExceeded && ` - Limited to ${maxStops}`}
          </div>
        )}
      </div>

      {/* Bottom right - Location control */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col items-end gap-2">
        {/* Toast message */}
        {locationMessage && (
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
            {locationMessage}
          </div>
        )}

        <button
          onClick={handleToggleLocationTracking}
          disabled={loading}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all disabled:opacity-50 ${
            watching
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
          }`}
          title={watching ? 'Click to stop tracking' : 'Click to start tracking'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default StopFinder;
