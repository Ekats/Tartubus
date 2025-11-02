import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import { useGeolocation } from '../hooks/useGeolocation';
import { useFavorites } from '../hooks/useFavorites';
import { getNearbyStops, getStopsByRoutes, getNextStopName } from '../services/digitransit';
import { getSetting } from '../utils/settings';
import { reverseGeocode } from '../utils/geocoding';
import { shouldShowDeparture, isDepartureLate } from '../utils/timeFormatter';
import CountdownTimer from './CountdownTimer';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom stop marker icons - modern, clean design
const createStopIcon = (color, isNearby = false) => {
  const size = isNearby ? 32 : 24;
  const dotSize = isNearby ? 10 : 8;

  return new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <!-- Outer ring with shadow -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="white" filter="url(#shadow)"/>
        <!-- Colored ring -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 3}" fill="none" stroke="${color}" stroke-width="2.5"/>
        <!-- Center dot -->
        <circle cx="${size/2}" cy="${size/2}" r="${dotSize/2}" fill="${color}"/>
      </svg>
    `),
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
    className: '',
  });
};

// Create favorite stop icon with star
const createFavoriteStopIcon = (color, isNearby = false) => {
  const size = isNearby ? 48 : 36;

  return new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow-fav">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/>
          </filter>
        </defs>
        <!-- Golden glow -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="#FCD34D" opacity="0.3"/>
        <!-- White circle background -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="white" filter="url(#shadow-fav)"/>
        <!-- Yellow outline -->
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 3}" fill="none" stroke="#FBBF24" stroke-width="2.5"/>
        <!-- Star - centered and sized to fill the circle -->
        <g transform="translate(${size/2}, ${size/2})">
          <path d="M 0,-${size/3} L ${size/9},-${size/9} L ${size/3},-${size/10} L ${size/7},${size/10} L ${size/6},${size/3} L 0,${size/6} L -${size/6},${size/3} L -${size/7},${size/10} L -${size/3},-${size/10} L -${size/9},-${size/9} Z"
                fill="#FBBF24" stroke="#F59E0B" stroke-width="2" filter="url(#shadow-fav)"/>
        </g>
      </svg>
    `),
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2],
    className: '',
  });
};

const stopIcon = createStopIcon('#6B7280'); // Gray for regular stops (not on filtered routes)
const nearbyStopIcon = createStopIcon('#6B7280'); // Gray for nearby stops when no filter
const selectedStopIcon = createStopIcon('#EF4444'); // Red for selected stop from Near Me

// Custom location pin icon for user location - orange
const locationPinIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pin-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M20 0C11.716 0 5 6.716 5 15c0 8.284 15 35 15 35s15-26.716 15-35C35 6.716 28.284 0 20 0z" fill="#F97316" stroke="white" stroke-width="2" filter="url(#pin-shadow)"/>
      <circle cx="20" cy="15" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [40, 50],
  iconAnchor: [20, 50],
  popupAnchor: [0, -50],
});

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
    <Marker position={[position.lat, position.lon]} icon={locationPinIcon}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

// Component to handle map events (zoom, pan, click)
function MapEventHandler({ onMapMove, onMapClick }) {
  const dragStartRef = useRef(null);
  const isDraggingRef = useRef(false);
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
    dragstart: (e) => {
      // Track when dragging starts
      // Leaflet's dragstart doesn't always have latlng, use map center as fallback
      const center = map.getCenter();
      dragStartRef.current = { lat: center.lat, lng: center.lng };
      isDraggingRef.current = true;
    },
    dragend: () => {
      // Mark that dragging has ended
      isDraggingRef.current = false;
    },
    click: (e) => {
      // Only trigger click if we weren't dragging
      if (isDraggingRef.current) {
        // Still dragging or just finished dragging, ignore this click
        return;
      }

      // Check if we moved significantly during the interaction
      if (dragStartRef.current) {
        const latDiff = Math.abs(e.latlng.lat - dragStartRef.current.lat);
        const lngDiff = Math.abs(e.latlng.lng - dragStartRef.current.lng);
        // If movement is tiny (< 0.0001 degrees ~11 meters), treat as click
        if (latDiff < 0.0001 && lngDiff < 0.0001) {
          if (onMapClick) onMapClick();
        }
        dragStartRef.current = null;
      } else {
        // No drag happened, definitely a click
        if (onMapClick) onMapClick();
      }
    },
  });
  return null;
}

// Component to handle location selection clicks
function LocationSelector({ onLocationSelect, disabled }) {
  const map = useMapEvents({
    click: (e) => {
      if (onLocationSelect && !disabled) {
        onLocationSelect({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
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

function StopFinder({ isDarkMode, selectedStop: highlightedStop, locationSelectionMode, manualLocation, onLocationSelected, onCancelLocationSelection }) {
  const { t } = useTranslation();
  const { location: gpsLocation, getLocation, startWatching, stopWatching, watching } = useGeolocation();

  // Use manual location if available, otherwise use GPS location
  const location = manualLocation || gpsLocation;
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
  const [pendingLocation, setPendingLocation] = useState(null);
  const [pendingLocationAddress, setPendingLocationAddress] = useState(null);
  const [expandedPopupStops, setExpandedPopupStops] = useState(new Map()); // Map of stopId -> expansion level
  const [nearbyStopsForRouting, setNearbyStopsForRouting] = useState([]); // Stops with departure data for routing
  const mapRef = useRef(null);
  const moveTimeoutRef = useRef(null);
  const lastMovePositionRef = useRef(null);
  const filterMenuRef = useRef(null);
  const openMarkerRef = useRef(null); // Track currently open marker
  const hasInitializedViewRef = useRef(false); // Track if we've panned to user location on mount

  // Custom cluster icon function - must be regular function for Leaflet
  const createClusterCustomIcon = useMemo(() => {
    return function(cluster) {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count >= 100) size = 'large';
      else if (count >= 10) size = 'medium';

      // Check if cluster contains any favorite stops
      const markers = cluster.getAllChildMarkers();
      const favoriteMarkers = markers.filter(marker => marker.options?.isFavorited === true);
      const hasFavorite = favoriteMarkers.length > 0;

      // If cluster has favorites, adjust position towards favorite markers
      if (hasFavorite && favoriteMarkers.length < markers.length) {
        // Calculate center of favorite markers
        let favLatSum = 0, favLngSum = 0;
        favoriteMarkers.forEach(marker => {
          const latlng = marker.getLatLng();
          favLatSum += latlng.lat;
          favLngSum += latlng.lng;
        });
        const favCenter = L.latLng(
          favLatSum / favoriteMarkers.length,
          favLngSum / favoriteMarkers.length
        );

        // Get current cluster center
        const clusterCenter = cluster.getLatLng();

        // Move cluster position 60% towards favorites
        const adjustedLat = clusterCenter.lat + (favCenter.lat - clusterCenter.lat) * 0.6;
        const adjustedLng = clusterCenter.lng + (favCenter.lng - clusterCenter.lng) * 0.6;

        // Update cluster position
        cluster.setLatLng(L.latLng(adjustedLat, adjustedLng));
      }

      if (hasFavorite) {
        return L.divIcon({
          html: `<div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px; filter: drop-shadow(0 0 3px rgba(255, 255, 255, 1)) drop-shadow(0 0 6px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));">⭐</span><span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 14px; font-weight: bold; color: #78350f; text-shadow: 0 0 3px rgba(255, 255, 255, 1);">${count}</span></div>`,
          className: `marker-cluster-favorite-emoji`,
          iconSize: L.point(40, 40),
        });
      }

      return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: L.point(40, 40),
      });
    };
  }, []);

  // Define city zones for filtering routes
  const CITY_ZONES = {
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

  // Default to Tartu center
  const defaultCenter = { lat: 58.3776, lon: 26.7290 };
  const center = location.lat ? location : defaultCenter;

  // Determine which city zone we're in based on map center
  const getCurrentCityZone = (mapCenter) => {
    const lat = mapCenter?.lat || center.lat;
    const lon = mapCenter?.lon || center.lon;

    // Calculate distance to each city center
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

    // Find closest city zone
    let closestZone = CITY_ZONES.tartu; // Default to Tartu
    let minDistance = Infinity;

    for (const zone of Object.values(CITY_ZONES)) {
      const distance = getDistance(lat, lon, zone.center.lat, zone.center.lon);
      if (distance < zone.radius && distance < minDistance) {
        minDistance = distance;
        closestZone = zone;
      }
    }

    return closestZone;
  };

  const [currentCityZone, setCurrentCityZone] = useState(getCurrentCityZone(center));
  const [cityZoneStopsLoaded, setCityZoneStopsLoaded] = useState(false);
  const [allZoneStops, setAllZoneStops] = useState([]); // Store ALL zone stops
  const [visibleBounds, setVisibleBounds] = useState(null); // Current viewport bounds

  // Fetch nearby stops with departure data when a stop is selected
  useEffect(() => {
    if (selectedStop && location.lat && location.lon) {
      const fetchNearbyStopsForRouting = async () => {
        try {
          console.log('🚀 Fetching nearby stops for routing to:', selectedStop.name);

          // Fetch stops near the user's location
          const nearbyUserStops = await getNearbyStops(location.lat, location.lon, 500, true);

          // Also fetch stops near the destination (to find nearby alternatives)
          const nearbyDestStops = await getNearbyStops(selectedStop.lat, selectedStop.lon, 300);

          console.log('✅ Got', nearbyUserStops?.length, 'stops near user and', nearbyDestStops?.length, 'stops near destination');

          setNearbyStopsForRouting({
            nearUser: nearbyUserStops || [],
            nearDestination: nearbyDestStops || []
          });
        } catch (error) {
          console.error('Error fetching nearby stops for routing:', error);
          setNearbyStopsForRouting({ nearUser: [], nearDestination: [] });
        }
      };
      fetchNearbyStopsForRouting();
    } else {
      setNearbyStopsForRouting({ nearUser: [], nearDestination: [] });
    }
  }, [selectedStop, location.lat, location.lon]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false); // Toggle for favorites-only view
  const boundsUpdateTimeoutRef = useRef(null);

  // Load ALL stops for the current city zone (once per zone)
  const loadCityZoneStops = async (zone) => {
    console.log(`📍 Loading all stops for ${zone.name} (${zone.radius/1000}km radius)...`);
    setLoading(true);
    setError(null);
    try {
      // Load ALL stops in the city zone radius
      const zoneStops = await getNearbyStops(zone.center.lat, zone.center.lon, zone.radius);
      console.log(`✅ Loaded ${zoneStops.length} stops for ${zone.name}`);
      setAllZoneStops(zoneStops); // Store all stops
      setStops(zoneStops); // Initially show all (will be filtered by viewport)
      setCityZoneStopsLoaded(true);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Error loading city zone stops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load stops for current city zone on mount
  useEffect(() => {
    // Auto-request location on startup and start watching for movement (only if no manual location)
    if (!manualLocation) {
      getLocation();
      startWatching();
    }

    // Load ALL stops for the current city zone (one-time)
    loadCityZoneStops(currentCityZone);

    // Cleanup: stop watching and clear timeouts when component unmounts
    return () => {
      stopWatching();
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      if (boundsUpdateTimeoutRef.current) {
        clearTimeout(boundsUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Stop GPS tracking when manual location is set, resume when cleared
  useEffect(() => {
    if (manualLocation) {
      stopWatching();
    } else {
      startWatching();
    }
  }, [manualLocation]);

  // When city zone changes, reload stops for new zone
  useEffect(() => {
    if (cityZoneStopsLoaded) {
      console.log(`🔄 City zone changed to ${currentCityZone.name}, reloading stops...`);
      setCityZoneStopsLoaded(false);
      setAllZoneStops([]); // Clear previous zone stops
      loadCityZoneStops(currentCityZone);
    }
  }, [currentCityZone.name]);

  // Filter stops by viewport when zone stops are loaded or map ref becomes available
  useEffect(() => {
    if (cityZoneStopsLoaded && mapRef.current && allZoneStops.length > 0) {
      // Initial viewport filter
      setTimeout(() => {
        if (mapRef.current) {
          const bounds = mapRef.current.getBounds();
          const initialBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          };
          setVisibleBounds(initialBounds);
          filterStopsByViewport(initialBounds);
        }
      }, 100); // Small delay to ensure map is ready
    }
  }, [cityZoneStopsLoaded, allZoneStops.length]);

  // No need to reload stops when location changes - we have all zone stops loaded

  // Center map on highlighted stop when navigating from Near Me, or on user location when just opening map
  useEffect(() => {
    if (highlightedStop && mapRef.current) {
      // Center on stop and zoom in
      mapRef.current.setView([highlightedStop.lat, highlightedStop.lon], 16);
      // Set as selected stop to show popup
      setSelectedStop(highlightedStop);
    }
  }, [highlightedStop]);

  // Pan to user location when map first loads and location becomes available
  useEffect(() => {
    if (!highlightedStop && !hasInitializedViewRef.current && mapRef.current && location.lat && location.lon) {
      // Pan to user location on initial load
      const timeout = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.setView([location.lat, location.lon], 15);
          hasInitializedViewRef.current = true;
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [location.lat, location.lon, highlightedStop]);

  // Auto-refresh departure times every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      // Refresh stops data silently (without showing loading indicator)
      // Use refreshOnly=true to merge data instead of replacing stops
      const currentLat = location.lat || defaultCenter.lat;
      const currentLon = location.lon || defaultCenter.lon;
      loadStops(currentLat, currentLon, currentZoom, false, true);
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

  const loadStops = async (lat, lon, zoom = 13, includeUserLocation = false, refreshOnly = false) => {
    if (!refreshOnly) {
      setLoading(true);
    }
    setError(null);
    try {
      const radius = getRadiusForZoom(zoom);
      const mapCenterStops = await getNearbyStops(lat, lon, radius);

      // If user has a location and we're not already loading from their location,
      // also load stops near the user
      let newStops = mapCenterStops;
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
        newStops = Array.from(stopMap.values());
      }

      // Helper function to calculate distance in degrees (rough approximation)
      const getDistance = (lat1, lon1, lat2, lon2) => {
        const latDiff = lat1 - lat2;
        const lonDiff = lon1 - lon2;
        return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
      };

      // Calculate cleanup threshold - 2x the fetch radius to keep stops visible while panning
      const cleanupThreshold = (getRadiusForZoom(zoom) * 2) / 111000; // Convert meters to degrees

      // If this is a refresh, merge with existing stops instead of replacing
      if (refreshOnly) {
        setStops(prevStops => {
          const stopMap = new Map();
          // Keep existing stops that are still reasonably close
          prevStops.forEach(stop => {
            const distance = getDistance(lat, lon, stop.lat, stop.lon);
            if (distance <= cleanupThreshold) {
              stopMap.set(stop.gtfsId, stop);
            }
          });
          // Update with new data (fresher departure times)
          newStops.forEach(stop => stopMap.set(stop.gtfsId, stop));
          return Array.from(stopMap.values());
        });
      } else {
        // Initial load or map movement - merge new stops with existing ones
        setStops(prevStops => {
          const stopMap = new Map();
          // Keep existing stops that are still within the extended range
          prevStops.forEach(stop => {
            const distance = getDistance(lat, lon, stop.lat, stop.lon);
            if (distance <= cleanupThreshold) {
              stopMap.set(stop.gtfsId, stop);
            }
          });
          // Add new stops
          newStops.forEach(stop => stopMap.set(stop.gtfsId, stop));
          return Array.from(stopMap.values());
        });
      }

      setNearbyStopIds(nearbyIds);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Error loading stops:', err);
      setError(err.message);
    } finally {
      if (!refreshOnly) {
        setLoading(false);
      }
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

  // Filter stops based on viewport bounds with buffer
  const filterStopsByViewport = (bounds) => {
    if (!bounds || allZoneStops.length === 0) return;

    // Calculate buffer (50% extra on each side = 1.5x viewport)
    const latBuffer = (bounds.north - bounds.south) * 0.5;
    const lonBuffer = (bounds.east - bounds.west) * 0.5;

    const bufferedBounds = {
      north: bounds.north + latBuffer,
      south: bounds.south - latBuffer,
      east: bounds.east + lonBuffer,
      west: bounds.west - lonBuffer,
    };

    // Filter stops within buffered viewport
    const visibleStops = allZoneStops.filter(stop => {
      return stop.lat <= bufferedBounds.north &&
             stop.lat >= bufferedBounds.south &&
             stop.lon <= bufferedBounds.east &&
             stop.lon >= bufferedBounds.west;
    });

    // Calculate nearby stops based on user location
    if (location.lat && location.lon) {
      const userRadius = getSetting('nearbyRadius') || 500;
      const nearbyIds = new Set();

      visibleStops.forEach(stop => {
        const distance = getDistanceFromCity(stop.lat, stop.lon, location.lat, location.lon);
        if (distance <= userRadius) {
          nearbyIds.add(stop.gtfsId);
        }
      });

      setNearbyStopIds(nearbyIds);
      console.log(`📍 ${nearbyIds.size} stops are nearby (within ${userRadius}m)`);
    }

    console.log(`📊 Showing ${visibleStops.length} stops in viewport (of ${allZoneStops.length} total)`);
    setStops(visibleStops);
  };

  const handleMapMove = (lat, lon, zoom) => {
    setCurrentZoom(zoom);

    // Check for city zone changes
    const newZone = getCurrentCityZone({ lat, lon });
    if (newZone.name !== currentCityZone.name) {
      console.log(`📍 Switched to ${newZone.name} zone`);
      setCurrentCityZone(newZone);
      setSelectedRoutes(new Set());
      return; // Zone change will trigger reload
    }

    // Update visible bounds with debouncing
    if (mapRef.current) {
      // Clear previous timeout
      if (boundsUpdateTimeoutRef.current) {
        clearTimeout(boundsUpdateTimeoutRef.current);
      }

      // Wait 300ms after map stops moving before updating
      boundsUpdateTimeoutRef.current = setTimeout(() => {
        const bounds = mapRef.current.getBounds();
        const newBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };
        setVisibleBounds(newBounds);
        filterStopsByViewport(newBounds);
      }, 300);
    }
  };

  // No longer needed - we have all zone stops loaded
  const handleLocationUpdate = (lat, lon) => {
    // Do nothing - stops are already loaded for the entire zone
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

  // Further filter by favorites if favorites-only mode is enabled
  if (showFavoritesOnly) {
    filteredStops = filteredStops.filter(stop => isFavorite(stop.gtfsId));
  }

  // Show all stops - no limit needed since we're only loading the zone
  // (Typically 100-200 stops for Tartu, very manageable)

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

  // Fetch address for pending location
  useEffect(() => {
    if (pendingLocation?.lat && pendingLocation?.lon) {
      reverseGeocode(pendingLocation.lat, pendingLocation.lon).then(addr => {
        if (addr) {
          setPendingLocationAddress(addr);
        } else {
          setPendingLocationAddress(t('nearMe.noLocation'));
        }
      });
    }
  }, [pendingLocation]);

  // Handler for location tap
  const handleLocationTap = (location) => {
    setPendingLocation(location);
    setPendingLocationAddress(t('common.loading'));
  };

  // Handler for apply button
  const handleApplyLocation = () => {
    if (pendingLocation && onLocationSelected) {
      onLocationSelected(pendingLocation);
    }
  };

  // Handler for cancel pending location
  const handleCancelPendingLocation = () => {
    setPendingLocation(null);
    setPendingLocationAddress(null);
  };

  // Handlers for popup expansion
  const expandPopupStop = (stopId) => {
    setExpandedPopupStops(prev => {
      const newMap = new Map(prev);
      const currentLevel = newMap.get(stopId) || 0;
      newMap.set(stopId, currentLevel + 1);
      return newMap;
    });
  };

  const collapsePopupStop = (stopId) => {
    setExpandedPopupStops(prev => {
      const newMap = new Map(prev);
      newMap.delete(stopId);
      return newMap;
    });
  };

  // Handler for map clicks - close popups and filter
  const handleMapClick = () => {
    // Close any open popup using the marker ref
    if (openMarkerRef.current) {
      openMarkerRef.current.closePopup();
      openMarkerRef.current = null;
    }
    // Clear selected stop
    setSelectedStop(null);
    // Close filter menu
    setShowRouteFilter(false);
  };

  // Load stops for selected routes - but only for routes in the current city zone
  useEffect(() => {
    const loadRouteStops = async () => {
      if (selectedRoutes.size > 0) {
        setLoadingRoutes(true);
        try {
          const routeNames = Array.from(selectedRoutes);

          // Pass city bounds to limit API query
          const cityBounds = {
            lat: currentCityZone.center.lat,
            lon: currentCityZone.center.lon,
            radius: currentCityZone.radius
          };

          const { stops: routeStopsData, routePatterns: patterns } = await getStopsByRoutes(routeNames, cityBounds);

          // Filter patterns to only include those in the current city zone
          // Check if any stop in the pattern is within the city zone radius
          const filteredPatterns = patterns.filter(pattern => {
            return pattern.stops.some(stop => {
              const distance = getDistanceFromCity(stop.lat, stop.lon, currentCityZone.center.lat, currentCityZone.center.lon);
              return distance <= currentCityZone.radius;
            });
          });

          // Get unique stops from filtered patterns that are also in the city zone
          const filteredStopsMap = new Map();
          filteredPatterns.forEach(pattern => {
            pattern.stops.forEach(stop => {
              const distance = getDistanceFromCity(stop.lat, stop.lon, currentCityZone.center.lat, currentCityZone.center.lon);
              if (distance <= currentCityZone.radius) {
                filteredStopsMap.set(stop.gtfsId, stop);
              }
            });
          });

          setRouteStops(Array.from(filteredStopsMap.values()));
          setRoutePatterns(filteredPatterns);

          console.log(`🚌 Loaded ${filteredPatterns.length} route patterns for ${currentCityZone.name}`);
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
  }, [selectedRoutes, currentCityZone]);

  // Helper function to calculate distance from city center
  const getDistanceFromCity = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={13}
        className="w-full h-full"
        zoomControl={true}
        maxZoom={18}
        zoomAnimation={true}
        zoomAnimationThreshold={4}
        fadeAnimation={true}
        markerZoomAnimation={true}
        preferCanvas={false}
        wheelPxPerZoomLevel={60}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          maxNativeZoom={18}
          className={isDarkMode ? 'map-tiles-dark' : ''}
        />

        {/* Map event handler */}
        {!locationSelectionMode && <MapEventHandler onMapMove={handleMapMove} onMapClick={handleMapClick} />}

        {/* Location selector - active when in selection mode */}
        {locationSelectionMode && <LocationSelector onLocationSelect={handleLocationTap} disabled={!!pendingLocation} />}

        {/* Pending location marker */}
        {pendingLocation && (
          <Marker position={[pendingLocation.lat, pendingLocation.lon]} icon={locationPinIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">{t('map.selectedLocation')}</div>
                <div>{pendingLocationAddress || t('common.loading')}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* User location marker */}
        {location.lat && !locationSelectionMode && <LocationMarker position={location} onLocationUpdate={handleLocationUpdate} mapRef={mapRef} />}

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

        {/* Stop markers with clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          disableClusteringAtZoom={15}
          iconCreateFunction={createClusterCustomIcon}
        >
        {filteredStops
          .slice()
          .sort((a, b) => {
            const aIsFav = isFavorite(a.gtfsId);
            const bIsFav = isFavorite(b.gtfsId);
            // Non-favorites first (0), favorites last (1)
            return (aIsFav ? 1 : 0) - (bIsFav ? 1 : 0);
          })
          .map((stop, idx) => {
          const isNearby = nearbyStopIds.has(stop.gtfsId);
          const isHighlighted = highlightedStop && stop.gtfsId === highlightedStop.gtfsId;
          const isFavorited = isFavorite(stop.gtfsId);

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

          // Use golden star icon for favorited stops (bigger and glowing if nearby)
          const markerIcon = isFavorited ? createFavoriteStopIcon(iconColor, isNearby) : createStopIcon(iconColor, isNearby);

          return (
            <Marker
              key={stop.gtfsId}
              position={[stop.adjustedLat, stop.adjustedLon]}
              icon={markerIcon}
              zIndexOffset={isFavorited ? 1000 : 0}
              eventHandlers={{
                add: (e) => {
                  // Set custom data when marker is added to the map
                  const marker = e.target;
                  marker.options.stopId = stop.gtfsId;
                  marker.options.isFavorited = isFavorited;
                },
                click: (e) => {
                  // Prevent event from bubbling to map
                  L.DomEvent.stopPropagation(e);
                  // Set selected stop to show overlay
                  setSelectedStop(stop);
                },
              }}
            >
              {false && ( // Disable popup, we'll use overlay instead
              <Popup maxWidth={300} autoPan={false} closeOnClick={false} onClose={() => {
                setSelectedStop(null);
                openMarkerRef.current = null;
              }}>
                <div className="p-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-lg mb-1">
                        {stop.name}
                        {(() => {
                          // Get the most common next stop from departures
                          const nextStops = stop.stoptimesWithoutPatterns
                            ?.map(dep => getNextStopName(dep))
                            .filter(Boolean);

                          if (nextStops && nextStops.length > 0) {
                            // Find most common next stop
                            const counts = {};
                            nextStops.forEach(name => counts[name] = (counts[name] || 0) + 1);
                            const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                            return <span className="text-gray-500 font-normal"> → {mostCommon}</span>;
                          }
                          return null;
                        })()}
                      </h3>
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
                      <div className="max-h-64 overflow-y-auto pr-1 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                        {(() => {
                          const expansionLevel = expandedPopupStops.get(stop.gtfsId) || 0;
                          // Filter out departures that are too far in the past
                          const validDepartures = stop.stoptimesWithoutPatterns.filter(dep =>
                            shouldShowDeparture(dep.scheduledArrival)
                          );
                          const totalDepartures = validDepartures.length;
                          let visibleCount = 3;
                          if (expansionLevel === 1) visibleCount = 8;
                          if (expansionLevel >= 2) visibleCount = totalDepartures;

                          const departureItems = validDepartures.slice(0, visibleCount).map((departure, idx) => {
                            const nextStop = getNextStopName(departure);
                            const isLate = isDepartureLate(departure.scheduledArrival);
                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between gap-2 text-sm ${isLate ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`${isLate ? 'bg-gray-400' : 'bg-blue-600'} text-white px-2 py-0.5 rounded font-bold text-xs shrink-0`}>
                                    {departure.trip?.route?.shortName || '?'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-xs truncate ${isLate ? 'text-gray-500' : 'text-gray-700'}`}>
                                      {departure.headsign || 'Unknown'}
                                    </div>
                                    {nextStop && (
                                      <div className="text-xs text-gray-500 truncate">
                                        → {nextStop}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className={`font-semibold text-xs shrink-0 ${isLate ? 'text-gray-500' : ''}`}>
                                  <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                                </span>
                              </div>
                            );
                          });

                          let expansionButton = null;
                          if (totalDepartures > 3) {
                            if (expansionLevel === 0) {
                              expansionButton = (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    expandPopupStop(stop.gtfsId);
                                  }}
                                  className="w-full text-center text-xs text-blue-600 hover:text-blue-700 py-1 border-t border-gray-200 mt-1"
                                >
                                  {`··· ${t('nearMe.showMore')} (${Math.min(5, totalDepartures - 3)})`}
                                </button>
                              );
                            } else if (expansionLevel === 1 && totalDepartures > 8) {
                              expansionButton = (
                                <div className="flex gap-1 pt-1 border-t border-gray-200 mt-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      collapsePopupStop(stop.gtfsId);
                                    }}
                                    className="flex-1 text-center text-xs text-gray-600 hover:text-gray-700 py-1"
                                  >
                                    − {t('nearMe.showLess')}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      expandPopupStop(stop.gtfsId);
                                    }}
                                    className="flex-1 text-center text-xs text-blue-600 hover:text-blue-700 py-1"
                                  >
                                    {`··· ${t('nearMe.showAll')} (${totalDepartures - 8})`}
                                  </button>
                                </div>
                              );
                            } else {
                              expansionButton = (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    collapsePopupStop(stop.gtfsId);
                                  }}
                                  className="w-full text-center text-xs text-gray-600 hover:text-gray-700 py-1 border-t border-gray-200 mt-1"
                                >
                                  − {t('nearMe.showLess')}
                                </button>
                              );
                            }
                          }

                          return (
                            <>
                              {departureItems}
                              {expansionButton}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No upcoming departures</p>
                  )}
                </div>
              </Popup>
              )}
            </Marker>
          );
        })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Top controls - Route filter */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setShowRouteFilter(!showRouteFilter)}
          className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 justify-center border border-gray-200 dark:border-gray-700 ${selectedRoutes.size > 0 ? 'ring-2 ring-primary dark:ring-blue-400' : ''}`}
        >
          <span className="text-lg">🚌</span>
          {t('map.filterRoutes')} {selectedRoutes.size > 0 ? `(${selectedRoutes.size})` : ''}
          <span className="text-xs opacity-60">• {currentCityZone.name}</span>
        </button>

        {/* Route filter dropdown */}
        {showRouteFilter && (
          <div ref={filterMenuRef} className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t('map.filterRoutes')}</h3>
              {selectedRoutes.size > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {t('map.clearFilters')}
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

        {/* Stop count - only show if filtered */}
        {!loading && stops.length > 0 && selectedRoutes.size > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-2 text-xs text-gray-600 dark:text-gray-300 text-center border border-gray-200 dark:border-gray-700">
            {t('map.showingStops', { shown: filteredStops.length, total: stops.length })}
            {` (${t('map.filtered')})`}
          </div>
        )}
      </div>

      {/* Bottom right - Location control */}
      <div className="absolute bottom-24 right-4 z-[1000] flex flex-col items-end gap-2">
        {/* Toast message */}
        {locationMessage && (
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
            {locationMessage}
          </div>
        )}

        {/* Favorites filter toggle button */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border-[2mm] border-white shadow-lg ${
            showFavoritesOnly
              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={showFavoritesOnly ? t('map.showAllStops') : t('map.showFavoritesOnly')}
        >
          <svg className="w-10 h-10" fill={showFavoritesOnly ? 'currentColor' : '#000000'} stroke={showFavoritesOnly ? 'none' : '#FFD700'} strokeWidth={showFavoritesOnly ? 0 : 2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>

        {/* Location tracking button */}
        <button
          onClick={handleToggleLocationTracking}
          disabled={loading}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-50 border-[2mm] border-white shadow-lg ${
            watching
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`}
          title={watching ? 'Click to stop tracking' : 'Click to start tracking'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Location Selection Mode Overlay */}
      {locationSelectionMode && (
        <div className="absolute top-0 left-0 right-0 z-[1000] bg-blue-600 dark:bg-blue-700 text-white p-4 shadow-lg">
          <div className="max-w-2xl mx-auto">
            {!pendingLocation ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold">{t('map.selectLocation')}</div>
                    <div className="text-xs text-blue-100">{t('map.tapOnMap')}</div>
                  </div>
                </div>
                <button
                  onClick={onCancelLocationSelection}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                >
                  {t('nearMe.cancel')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold mb-1">{t('map.locationSelected')}</div>
                    <div className="text-sm text-blue-100 truncate">{pendingLocationAddress || t('common.loading')}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelPendingLocation}
                    className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                  >
                    {t('nearMe.cancel')}
                  </button>
                  <button
                    onClick={handleApplyLocation}
                    className="flex-1 px-4 py-2 bg-white hover:bg-gray-100 text-blue-600 rounded-lg transition-colors text-sm font-medium"
                  >
                    {t('map.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen stop details overlay */}
      {selectedStop && !locationSelectionMode && (
        <div className="absolute inset-x-0 top-0 bottom-24 z-[2000] bg-white dark:bg-gray-900 flex flex-col rounded-b-3xl shadow-2xl animate-slide-down">
          {/* Header */}
          <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{selectedStop.name}</h2>
              <p className="text-sm text-blue-100">Stop {selectedStop.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(selectedStop)}
                className={`p-2 rounded-lg transition-colors ${
                  isFavorite(selectedStop.gtfsId)
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                <svg className="w-6 h-6" fill={isFavorite(selectedStop.gtfsId) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedStop(null)}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Route to this stop section */}
            {location.lat && location.lon && nearbyStopsForRouting?.nearUser?.length > 0 && nearbyStopsForRouting?.nearDestination?.length > 0 && (() => {
              console.log('🔍 Analyzing routes to', selectedStop.name, 'area');

              // Create a set of destination stop IDs (all stops near the selected destination)
              const destinationStopIds = new Set(
                nearbyStopsForRouting.nearDestination.map(stop => stop.gtfsId)
              );
              console.log('🎯 Looking for buses going to any of', destinationStopIds.size, 'stops near destination');

              // Use the fetched nearby stops with full departure data
              const nearbyStopsWithRoutes = nearbyStopsForRouting.nearUser
                .filter(stop => !destinationStopIds.has(stop.gtfsId)) // Don't include destination stops themselves
                .map(nearbyStop => {
                  // Check departures to see if any go to the destination AREA
                  const connectingDepartures = nearbyStop.stoptimesWithoutPatterns?.filter(dep => {
                    // Check if this trip's route stops at ANY stop in the destination area
                    if (!dep.trip?.stoptimes) {
                      return false;
                    }

                    const currentStopPosition = dep.stopPosition;
                    const destinationStop = dep.trip.stoptimes.find(
                      ts => destinationStopIds.has(ts.stop?.gtfsId) && ts.stopPosition > currentStopPosition
                    );

                    if (destinationStop) {
                      console.log('✅ Found connection:', dep.trip?.route?.shortName, 'from', nearbyStop.name, 'to', destinationStop.stop?.name || 'destination area');
                    }

                    return !!destinationStop;
                  }) || [];

                  if (connectingDepartures.length > 0) {
                    console.log('🎯', nearbyStop.name, 'has', connectingDepartures.length, 'connecting buses');

                    // Calculate walking distance
                    const latDiff = nearbyStop.lat - location.lat;
                    const lonDiff = nearbyStop.lon - location.lon;
                    const walkingDistance = Math.round(Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000);

                    // Group by route for display
                    const routeMap = new Map();
                    connectingDepartures.forEach(dep => {
                      const routeName = dep.trip?.route?.shortName;
                      if (routeName && !routeMap.has(routeName)) {
                        routeMap.set(routeName, dep);
                      }
                    });

                    return {
                      stop: nearbyStop,
                      departures: connectingDepartures.slice(0, 3), // Top 3 departures
                      routes: Array.from(routeMap.values()).slice(0, 3), // Top 3 unique routes
                      walkingDistance
                    };
                  }
                  return null;
                })
                .filter(Boolean)
                .sort((a, b) => a.walkingDistance - b.walkingDistance)
                .slice(0, 5); // Show top 5 nearest stops

              if (nearbyStopsWithRoutes.length > 0) {
                return (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                        {t('map.howToGetHere') || 'How to get here'}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {nearbyStopsWithRoutes.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                                {item.stop.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                🚶 {item.walkingDistance}m walk • ~{Math.ceil(item.walkingDistance / 80)} min
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {item.departures.map((dep, depIdx) => (
                              <div key={depIdx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold text-xs">
                                    {dep.trip?.route?.shortName || '?'}
                                  </span>
                                  <span className="text-gray-700 dark:text-gray-300 text-xs">
                                    → {dep.headsign}
                                  </span>
                                </div>
                                <span className="font-semibold text-green-600 dark:text-green-400 text-xs">
                                  <CountdownTimer scheduledArrival={dep.scheduledArrival} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Show route directions if filtered */}
            {stopToPatterns.has(selectedStop.gtfsId) && (
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Routes at this stop:</p>
                <div className="space-y-2">
                  {stopToPatterns.get(selectedStop.gtfsId).map((pattern, patternIdx) => {
                    const colors = ['#0066CC', '#FBBF24', '#10B981', '#F59E0B'];
                    const dirId = (pattern.directionId >= 0) ? pattern.directionId : 0;
                    const lineColor = colors[dirId % colors.length];
                    return (
                      <div key={patternIdx} className="flex items-center gap-2">
                        <span
                          className="font-bold px-2 py-1 rounded text-white text-sm"
                          style={{ backgroundColor: lineColor }}
                        >
                          {pattern.routeShortName}
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">→ {pattern.headsign}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next departures */}
            {selectedStop.stoptimesWithoutPatterns && selectedStop.stoptimesWithoutPatterns.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Next buses:</h3>
                <div className="space-y-2">
                  {(() => {
                    const expansionLevel = expandedPopupStops.get(selectedStop.gtfsId) || 0;
                    // Filter out departures that are too far in the past
                    const validDepartures = selectedStop.stoptimesWithoutPatterns.filter(dep =>
                      shouldShowDeparture(dep.scheduledArrival)
                    );
                    const totalDepartures = validDepartures.length;
                    let visibleCount = 3;
                    if (expansionLevel === 1) visibleCount = 8;
                    if (expansionLevel >= 2) visibleCount = totalDepartures;

                    const departureItems = validDepartures.slice(0, visibleCount).map((departure, idx) => {
                      const nextStop = getNextStopName(departure);
                      const isLate = isDepartureLate(departure.scheduledArrival);
                      return (
                        <div
                          key={idx}
                          className={`${isLate ? 'bg-gray-100 dark:bg-gray-900 opacity-60' : 'bg-gray-50 dark:bg-gray-800'} rounded-lg p-3 border ${isLate ? 'border-gray-300 dark:border-gray-800' : 'border-gray-200 dark:border-gray-700'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`${isLate ? 'bg-gray-400 dark:bg-gray-600' : 'bg-blue-600'} text-white px-3 py-1 rounded font-bold text-sm shrink-0`}>
                                {departure.trip?.route?.shortName || '?'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className={`font-medium truncate ${isLate ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                  {departure.headsign || 'Unknown'}
                                </div>
                                {nextStop && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    → {nextStop}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`font-bold text-lg shrink-0 ${isLate ? 'text-gray-500 dark:text-gray-500' : 'text-blue-600 dark:text-blue-400'}`}>
                              <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                            </span>
                          </div>
                        </div>
                      );
                    });

                    let expansionButton = null;
                    if (totalDepartures > 3) {
                      if (expansionLevel === 0) {
                        expansionButton = (
                          <button
                            onClick={() => expandPopupStop(selectedStop.gtfsId)}
                            className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                          >
                            {`··· ${t('nearMe.showMore')} (${Math.min(5, totalDepartures - 3)})`}
                          </button>
                        );
                      } else if (expansionLevel === 1 && totalDepartures > 8) {
                        expansionButton = (
                          <div className="flex gap-2">
                            <button
                              onClick={() => collapsePopupStop(selectedStop.gtfsId)}
                              className="flex-1 text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                            >
                              − {t('nearMe.showLess')}
                            </button>
                            <button
                              onClick={() => expandPopupStop(selectedStop.gtfsId)}
                              className="flex-1 text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                            >
                              {`··· ${t('nearMe.showAll')} (${totalDepartures - 8})`}
                            </button>
                          </div>
                        );
                      } else {
                        expansionButton = (
                          <button
                            onClick={() => collapsePopupStop(selectedStop.gtfsId)}
                            className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                          >
                            − {t('nearMe.showLess')}
                          </button>
                        );
                      }
                    }

                    return (
                      <>
                        {departureItems}
                        {expansionButton}
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No upcoming departures</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StopFinder;
