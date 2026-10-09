// Places the bus a user tapped on Near Me (its stops from the boarding stop to the end)
// on the map, using the coordinates of the selected route's patterns.

import { formatClockTime } from './timeFormatter';

const sameStop = (a, b) => a.gtfsId === b.gtfsId || (!!a.code && !!b.code && a.code === b.code);

/**
 * @param {{boardStopId: string, stops: Array<{gtfsId, name, time, code?, lat?, lon?}>}} trip
 * @param {Array} routePatterns - patterns from getStopsByRoutes (stops carry gtfsId, code, lat, lon)
 * @param {string} routeNumber
 * @returns {{markers: Array, patterns: Array, unplaced: number}|null} null when the trip can't be
 *   placed (fewer than two stops with coordinates), so the caller keeps the normal map
 *   markers: stops with coordinates, in trip order, kind 'first' | 'mid' | 'last'
 *   patterns: the patterns of this direction (boarding stop, later the last placed stop);
 *     all patterns of the route when none fits
 *   unplaced: trip stops skipped for lack of coordinates
 */
export function buildTripView(trip, routePatterns, routeNumber) {
  if (!trip?.stops?.length) return null;
  const patterns = (routePatterns || []).filter(p => p.routeShortName === routeNumber);

  const placed = [];
  trip.stops.forEach(stop => {
    const source = stop.lat != null && stop.lon != null
      ? stop
      : patterns.flatMap(p => p.stops).find(ps => sameStop(stop, ps));
    if (source) placed.push({ gtfsId: stop.gtfsId, name: stop.name, time: stop.time, approx: stop.approx, lat: source.lat, lon: source.lon, code: stop.code });
  });
  if (placed.length < 2) return null;

  const markers = placed.map((m, i) => ({ ...m, kind: i === 0 ? 'first' : i === placed.length - 1 ? 'last' : 'mid' }));
  const board = markers[0];
  const last = markers[markers.length - 1];
  const direction = patterns.filter(p => {
    const from = p.stops.findIndex(s => sameStop(board, s));
    const to = p.stops.findLastIndex(s => sameStop(last, s));
    return from >= 0 && to > from;
  });

  return { markers, patterns: direction.length > 0 ? direction : patterns, unplaced: trip.stops.length - placed.length };
}

/**
 * The trip handed to the map for a Near Me departure: its stops from the boarding stop on.
 * The boarding stop shows the row's realtime-aware arrival; when the bus runs early or late the
 * later stops get that delay added to their scheduled time and are flagged `approx`.
 */
export function buildDepartureTrip(departure, boardStop) {
  const all = departure.trip?.stoptimes || [];
  const at = all.findIndex(st => st.stopPosition === departure.stopPosition);
  if (at < 0) return null;
  const board = all[at];
  const delay = departure.realtime && departure.realtimeArrival != null && board.scheduledArrival != null
    ? departure.realtimeArrival - board.scheduledArrival
    : 0;
  return {
    boardStopId: boardStop.gtfsId,
    stops: all.slice(at).map((st, i) => {
      const shifted = i > 0 && delay !== 0 && st.scheduledArrival != null;
      const seconds = i === 0 && departure.realtime && departure.realtimeArrival != null
        ? departure.realtimeArrival
        : shifted ? st.scheduledArrival + delay : st.scheduledArrival;
      return {
        gtfsId: st.stop?.gtfsId,
        name: st.stop?.name || '',
        code: st.stop?.code,
        time: seconds != null ? formatClockTime(seconds) : '',
        ...(shifted && { approx: true }),
        ...(i === 0 && boardStop.lat != null ? { lat: boardStop.lat, lon: boardStop.lon } : {}),
      };
    }),
  };
}
