import { describe, it, expect } from 'vitest';
import { buildTripView, buildDepartureTrip } from '../tripRoute';

const stop = (gtfsId, lat, code) => ({ gtfsId, name: `Stop ${gtfsId}`, code, lat, lon: 26.7 });
const pattern = (directionId, stops, routeShortName = '613') => ({ routeShortName, directionId, stops, coordinates: [] });
const tripStop = (gtfsId, extra = {}) => ({ gtfsId, name: `Stop ${gtfsId}`, time: '10:00', ...extra });

const A = stop('A', 58.1, 'a-1');
const B = stop('B', 58.2, 'b-1');
const C = stop('C', 58.3, 'c-1');
const out = pattern(0, [A, B, C]);
const back = pattern(1, [C, B, A]);

describe('buildTripView', () => {
  it('matches trip stops to pattern coordinates by id and marks first / mid / last', () => {
    const view = buildTripView({ boardStopId: 'A', stops: [tripStop('A'), tripStop('B'), tripStop('C')] }, [out, back], '613');
    expect(view.markers.map(m => [m.gtfsId, m.kind, m.lat])).toEqual([['A', 'first', 58.1], ['B', 'mid', 58.2], ['C', 'last', 58.3]]);
    expect(view.unplaced).toBe(0);
  });

  it('draws only the pattern that goes from the boarding stop to the last stop', () => {
    const trip = { boardStopId: 'A', stops: [tripStop('A'), tripStop('B'), tripStop('C')] };
    expect(buildTripView(trip, [out, back], '613').patterns).toEqual([out]);
    const reverse = { boardStopId: 'C', stops: [tripStop('C'), tripStop('B'), tripStop('A')] };
    expect(buildTripView(reverse, [out, back], '613').patterns).toEqual([back]);
  });

  it('falls back to the public stop code when the ids differ', () => {
    const trip = { boardStopId: 'new:A', stops: [tripStop('new:A', { code: 'a-1' }), tripStop('new:B', { code: 'b-1' }), tripStop('new:C', { code: 'c-1' })] };
    const view = buildTripView(trip, [out, back], '613');
    expect(view.markers.map(m => m.lat)).toEqual([58.1, 58.2, 58.3]);
    expect(view.patterns).toEqual([out]);
  });

  it('uses coordinates given on the trip stop (the boarding stop)', () => {
    const trip = { boardStopId: 'X', stops: [tripStop('X', { lat: 58.0, lon: 26.6 }), tripStop('B'), tripStop('C')] };
    const view = buildTripView(trip, [out], '613');
    expect(view.markers[0]).toMatchObject({ gtfsId: 'X', kind: 'first', lat: 58.0 });
  });

  it('skips a stop without coordinates; the last placed stop becomes the last', () => {
    const trip = { boardStopId: 'A', stops: [tripStop('A'), tripStop('B'), tripStop('Z')] };
    const view = buildTripView(trip, [out, back], '613');
    expect(view.markers.map(m => [m.gtfsId, m.kind])).toEqual([['A', 'first'], ['B', 'last']]);
    expect(view.unplaced).toBe(1);
    expect(view.patterns).toEqual([out]);
  });

  it('draws all patterns of the route when none runs boarding stop -> last stop', () => {
    const odd = pattern(0, [C, A]);
    const trip = { boardStopId: 'A', stops: [tripStop('A'), tripStop('B')] };
    expect(buildTripView(trip, [odd, pattern(1, [B, C])], '613').patterns).toHaveLength(2);
  });

  it('ignores patterns of other routes', () => {
    const other = pattern(0, [A, B, C], '4');
    expect(buildTripView({ boardStopId: 'A', stops: [tripStop('B'), tripStop('C')] }, [other], '613')).toBeNull();
  });

  it('returns null without patterns or with fewer than two placed stops', () => {
    const trip = { boardStopId: 'A', stops: [tripStop('A'), tripStop('B'), tripStop('C')] };
    expect(buildTripView(trip, [], '613')).toBeNull();
    expect(buildTripView({ boardStopId: 'A', stops: [tripStop('A'), tripStop('Z')] }, [out], '613')).toBeNull();
    expect(buildTripView(undefined, [out], '613')).toBeNull();
  });
});

describe('buildDepartureTrip times', () => {
  const at = (h, m) => h * 3600 + m * 60;
  const st = (id, position, seconds) => ({ stop: { gtfsId: id, name: id }, stopPosition: position, scheduledArrival: seconds });
  const departure = (extra) => ({
    stopPosition: 1, scheduledArrival: at(10, 0),
    trip: { stoptimes: [st('P', 0, at(9, 55)), st('A', 1, at(10, 0)), st('B', 2, at(10, 5)), st('C', 3, at(10, 12))] },
    ...extra,
  });
  const board = { gtfsId: 'A', lat: 58, lon: 26 };
  const times = (trip) => trip.stops.map(s => [s.time, !!s.approx]);

  it('on time: scheduled times, nothing flagged', () => {
    expect(times(buildDepartureTrip(departure({ realtime: true, realtimeArrival: at(10, 0) }), board)))
      .toEqual([['10:00', false], ['10:05', false], ['10:12', false]]);
  });

  it('3 min late: boarding exact, later stops shifted and flagged', () => {
    expect(times(buildDepartureTrip(departure({ realtime: true, realtimeArrival: at(10, 3) }), board)))
      .toEqual([['10:03', false], ['10:08', true], ['10:15', true]]);
  });

  it('early: later stops shifted back', () => {
    expect(times(buildDepartureTrip(departure({ realtime: true, realtimeArrival: at(9, 58) }), board)))
      .toEqual([['09:58', false], ['10:03', true], ['10:10', true]]);
  });

  it('not realtime: schedule as is, even if a stale realtime value is present', () => {
    expect(times(buildDepartureTrip(departure({ realtime: false, realtimeArrival: at(10, 3) }), board)))
      .toEqual([['10:00', false], ['10:05', false], ['10:12', false]]);
  });
});
