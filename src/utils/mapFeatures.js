// What the map draws, worked out from the app's data: which icon a stop gets, the lines of a route
// filter and of a journey, the labelled stops of a journey - and the GeoJSON the map layers take.
// The app keeps coordinates as [lat, lon]; GeoJSON wants [lon, lat].

// Direction 0: blue, direction 1: yellow, then green and orange
export const ROUTE_COLORS = ['#0066CC', '#FBBF24', '#10B981', '#F59E0B'];
export const directionColor = (directionId) =>
  ROUTE_COLORS[(directionId >= 0 ? directionId : 0) % ROUTE_COLORS.length];

export const STOP_COLOR = '#2563EB'; // any stop
export const STOP_COLOR_NEARBY = '#10B981'; // within the "near me" radius
export const STOP_COLOR_HIGHLIGHTED = '#EF4444'; // opened from Near Me / Favorites
export const STOP_COLOR_TRIP = '#FBBF24'; // stops of a shown trip or journey

/** Name of a stop icon; mapIcons.js draws the picture for it */
export const stopIconName = (color, isLarge = false) => `stop|${color}|${isLarge ? 'large' : 'normal'}`;
export const favoriteIconName = (isLarge = false) => `favorite|${isLarge ? 'large' : 'normal'}`;

export function pointCollection(points) {
  return {
    type: 'FeatureCollection',
    features: points.map(({ lat, lon, ...properties }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties,
    })),
  };
}

export function lineCollection(lines) {
  return {
    type: 'FeatureCollection',
    features: lines
      .filter(line => line.positions?.length >= 2)
      .map(({ positions, ...properties }) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: positions.map(([lat, lon]) => [lon, lat]) },
        properties,
      })),
  };
}

/**
 * The stops to draw, each with its icon: a favourite gets the star, otherwise the ring is red for
 * the highlighted stop, the direction colour for a stop of a filtered route, green when nearby,
 * else blue. Nearby stops are drawn larger. Favourites come last, so they are drawn on top.
 */
export function stopPoints(stops, { nearbyStopIds, highlightedId, stopToPatterns, isFavorite }) {
  return stops
    .map(stop => {
      const isNearby = nearbyStopIds.has(stop.gtfsId);
      const favorite = !!isFavorite(stop.gtfsId);
      let color = STOP_COLOR;
      if (highlightedId && stop.gtfsId === highlightedId) {
        color = STOP_COLOR_HIGHLIGHTED;
      } else if (stopToPatterns.has(stop.gtfsId)) {
        color = directionColor(stopToPatterns.get(stop.gtfsId)[0].directionId);
      } else if (isNearby) {
        color = STOP_COLOR_NEARBY;
      }
      return {
        id: stop.gtfsId,
        lat: stop.adjustedLat ?? stop.lat,
        lon: stop.adjustedLon ?? stop.lon,
        icon: favorite ? favoriteIconName(isNearby) : stopIconName(color, isNearby),
        favorite,
      };
    })
    .sort((a, b) => (a.favorite ? 1 : 0) - (b.favorite ? 1 : 0));
}

/** One line per route pattern, along its road geometry when there is one, else stop to stop */
export function patternLines(patterns) {
  return patterns.map(pattern => ({
    positions: pattern.coordinates?.length > 0 ? pattern.coordinates : pattern.stops.map(stop => [stop.lat, stop.lon]),
    color: directionColor(pattern.directionId),
  }));
}

const legPositions = (leg, decode) => {
  const positions = leg.geometry ? decode(leg.geometry) : [];
  // No geometry: a straight line from start to end
  return positions.length > 0 ? positions : [[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]];
};

/** One line per journey leg: walking green and dashed, the bus blue and wider */
export function journeyLines(journey, decode) {
  return (journey?.legs || []).map(leg => ({
    positions: legPositions(leg, decode),
    color: leg.mode === 'WALK' ? '#10B981' : '#3B82F6',
    width: leg.mode === 'WALK' ? 4 : 6,
    dashed: leg.mode === 'WALK',
  }));
}

/** Every point of a journey, for fitting the map to it */
export function journeyCoords(journey, decode) {
  return (journey?.legs || []).flatMap(leg => [
    [leg.from.lat, leg.from.lon],
    ...(leg.geometry ? decode(leg.geometry) : []),
    [leg.to.lat, leg.to.lon],
  ]);
}

const clock = (date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * The stops of a journey's bus legs, in order. Each has `kind`:
 *   'board'    - getting on (label always shown for the first bus, on tap for a later one)
 *   'mid'      - a stop passed on the way, with an estimated time (on tap)
 *   'transfer' - getting off one bus and on the next at the same stop (label always shown)
 *   'alight'   - getting off (label always shown for the last bus, on tap otherwise)
 * `permanent` says whether the label is always shown, `large` whether the stop gets the larger icon.
 */
export function journeyStops(journey) {
  const markers = [];
  const legs = journey?.legs || [];
  // A transfer stop is drawn once, by the leg that arrives there
  const drawn = new Set();

  legs.forEach((leg, legIdx) => {
    if (leg.mode !== 'BUS') return;

    const legStart = leg.startTime ? new Date(leg.startTime) : new Date(journey.start);
    const legEnd = leg.endTime ? new Date(leg.endTime) : new Date(journey.end);
    const route = leg.route?.shortName;
    const isFirstBus = !legs.slice(0, legIdx).some(l => l.mode === 'BUS');
    const nextBusLeg = legs.slice(legIdx + 1).find(l => l.mode === 'BUS');
    const isTransfer = !!nextBusLeg && leg.to.stop?.gtfsId === nextBusLeg.from.stop?.gtfsId;

    if (leg.from.stop && !drawn.has(leg.from.stop.gtfsId)) {
      markers.push({
        key: `from-${legIdx}`, kind: 'board', lat: leg.from.lat, lon: leg.from.lon, large: true,
        permanent: isFirstBus, first: isFirstBus, name: leg.from.stop.name, route, time: clock(legStart),
      });
      drawn.add(leg.from.stop.gtfsId);
    }

    // The times of the stops in between are spread evenly over the leg
    const between = leg.intermediateStops || [];
    const timePerStop = (legEnd - legStart) / (between.length + 2);
    between.forEach((stop, stopIdx) => {
      markers.push({
        key: `mid-${legIdx}-${stopIdx}`, kind: 'mid', lat: stop.lat, lon: stop.lon, large: false,
        permanent: false, name: stop.name, route, time: clock(new Date(legStart.getTime() + timePerStop * (stopIdx + 1))),
      });
    });

    if (leg.to.stop) {
      if (isTransfer) {
        markers.push({
          key: `transfer-${legIdx}`, kind: 'transfer', lat: leg.to.lat, lon: leg.to.lon, large: true,
          permanent: true, name: leg.to.stop.name, route, time: clock(legEnd),
          nextRoute: nextBusLeg.route?.shortName, nextTime: clock(new Date(nextBusLeg.startTime)),
        });
        drawn.add(leg.to.stop.gtfsId);
      } else {
        const isLastBus = !nextBusLeg;
        markers.push({
          key: `to-${legIdx}`, kind: 'alight', lat: leg.to.lat, lon: leg.to.lon, large: true,
          permanent: isLastBus, last: isLastBus, name: leg.to.stop.name, route, time: clock(legEnd),
        });
      }
    }
  });

  return markers;
}
