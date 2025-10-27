import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import { useGeolocation } from '../hooks/useGeolocation';
import { getNearbyStops, getStopsByRoutes } from '../services/digitransit';
import { formatArrivalTime } from '../utils/timeFormatter';
import { getSetting } from '../utils/settings';
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

// Component to update map view when location changes
function LocationMarker({ position, onLocationUpdate }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lon], 15);
      // Load stops around new location
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

  useEffect(() => {
    if (!map || positions.length === 0) {
      return;
    }

    // Create polyline
    const polyline = L.polyline(positions, {
      color: color,
      weight: 4,
      opacity: 0.7,
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
    };
  }, [map, positions, color, headsign, routeName, stopCount]);

  return null;
}

function StopFinder() {
  const { location, getLocation } = useGeolocation();
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

  // Default to Tartu center
  const defaultCenter = { lat: 58.3776, lon: 26.7290 };
  const center = location.lat ? location : defaultCenter;

  // Load stops around the center on mount
  useEffect(() => {
    loadStops(center.lat, center.lon, currentZoom);
  }, []);

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
    } catch (err) {
      console.error('Error loading stops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMapMove = (lat, lon, zoom) => {
    setCurrentZoom(zoom);
    loadStops(lat, lon, zoom);
  };

  const handleLocationUpdate = (lat, lon) => {
    loadStops(lat, lon, currentZoom, true);
  };

  const handleFindMyLocation = () => {
    getLocation();
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
        />

        {/* Map event handler */}
        <MapEventHandler onMapMove={handleMapMove} />

        {/* User location marker */}
        {location.lat && <LocationMarker position={location} onLocationUpdate={handleLocationUpdate} />}

        {/* Route lines with direction arrows */}
        {routePatterns.map((pattern, idx) => {
          // Use the coordinates from geometry (which follow roads)
          const positions = pattern.coordinates && pattern.coordinates.length > 0
            ? pattern.coordinates
            : pattern.stops.map(stop => [stop.lat, stop.lon]);

          // Use different colors for different directions
          const colors = ['#0066CC', '#10B981', '#F59E0B', '#EF4444'];
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

          // Determine marker color based on route patterns
          let iconColor = '#6B7280'; // Default gray

          if (stopToPatterns.has(stop.gtfsId)) {
            const patterns = stopToPatterns.get(stop.gtfsId);
            // Use the color of the first pattern at this stop
            const colors = ['#0066CC', '#10B981', '#F59E0B', '#EF4444'];
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
              <Popup maxWidth={300}>
                <div className="p-2">
                  <h3 className="font-bold text-lg mb-1">{stop.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Stop {stop.code}</p>

                  {/* Show route directions if filtered */}
                  {stopToPatterns.has(stop.gtfsId) && (
                    <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="font-semibold text-xs text-gray-700 mb-1">Routes at this stop:</p>
                      {stopToPatterns.get(stop.gtfsId).map((pattern, patternIdx) => {
                        const colors = ['#0066CC', '#10B981', '#F59E0B', '#EF4444'];
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
                            {formatArrivalTime(departure.scheduledArrival)}
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

      {/* Floating controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Control buttons row */}
        <div className="flex gap-2">
          <button
            onClick={handleFindMyLocation}
            disabled={loading}
            className="flex-1 bg-white shadow-lg rounded-lg px-4 py-3 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
          >
            <span className="text-lg">📍</span>
            Find My Location
          </button>
          <button
            onClick={() => setShowRouteFilter(!showRouteFilter)}
            className={`bg-white shadow-lg rounded-lg px-4 py-3 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 justify-center ${selectedRoutes.size > 0 ? 'ring-2 ring-primary' : ''}`}
          >
            <span className="text-lg">🚌</span>
            Filter {selectedRoutes.size > 0 ? `(${selectedRoutes.size})` : ''}
          </button>
        </div>

        {/* Route filter dropdown */}
        {showRouteFilter && (
          <div className="bg-white shadow-lg rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Filter by Route</h3>
              {selectedRoutes.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:text-blue-700 font-medium"
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
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading indicator for map stops */}
        {loading && (
          <div className="bg-white shadow-lg rounded-lg px-4 py-3 text-sm text-gray-600 text-center">
            Loading stops...
          </div>
        )}

        {/* Loading indicator for route data */}
        {loadingRoutes && (
          <div className="bg-blue-50 border border-blue-200 shadow-lg rounded-lg px-4 py-3 text-sm text-blue-700 text-center flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading route...</span>
          </div>
        )}

        {/* Stop count */}
        {!loading && stops.length > 0 && (
          <div className="bg-white shadow-lg rounded-lg px-4 py-2 text-xs text-gray-600 text-center">
            Showing {filteredStops.length} of {stops.length} stops
            {selectedRoutes.size > 0 && ` (filtered)`}
            {stopsLimitExceeded && ` - Limited to ${maxStops}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default StopFinder;
