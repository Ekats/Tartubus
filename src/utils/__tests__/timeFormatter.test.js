import { describe, it, expect } from 'vitest';
import { shouldShowDeparture, isDepartureLate, formatArrivalTime, getArrivalDate, formatArrivalClock, roundMeters, formatDistance, formatClockFromDate } from '../timeFormatter';

// Service day 2026-09-28 in Tallinn: local midnight is 21:00 UTC the day before (EEST, UTC+3)
const SERVICE_DAY = Date.UTC(2026, 8, 27, 21, 0, 0) / 1000;
const at = (h, m) => h * 3600 + m * 60; // seconds after the service day's midnight
const tallinn = (h, m) => new Date(Date.UTC(2026, 8, 27, 21 + h, m)); // Tallinn wall-clock time on 2026-09-28

describe('departure times against a chosen (planned) time', () => {
  const plannedTomorrow0800 = tallinn(8, 0);

  it('shows a departure shortly before the chosen time and hides older ones', () => {
    expect(shouldShowDeparture(at(7, 55), { serviceDay: SERVICE_DAY }, plannedTomorrow0800)).toBe(true);
    expect(shouldShowDeparture(at(7, 45), { serviceDay: SERVICE_DAY }, plannedTomorrow0800)).toBe(false);
  });

  it('counts minutes from the chosen time, not from now', () => {
    expect(formatArrivalTime(at(8, 12), { serviceDay: SERVICE_DAY }, plannedTomorrow0800)).toBe('12 min');
    expect(isDepartureLate(at(8, 12), { serviceDay: SERVICE_DAY }, plannedTomorrow0800)).toBe(false);
    expect(isDepartureLate(at(7, 58), { serviceDay: SERVICE_DAY }, plannedTomorrow0800)).toBe(true);
  });

  it('uses the realtime arrival when there is one', () => {
    const late = { serviceDay: SERVICE_DAY, realtime: true, realtimeArrival: at(8, 20) };
    expect(formatArrivalTime(at(8, 12), late, plannedTomorrow0800)).toBe('20 min');
  });
});

describe('exact times from serviceDay', () => {
  it('handles a departure after midnight of a service day that started yesterday', () => {
    // 24:30 on the 2026-09-28 service day is 00:30 on the 29th
    const arrival = getArrivalDate(at(24, 30), { serviceDay: SERVICE_DAY }, tallinn(23, 50));
    expect(arrival.date.toISOString()).toBe('2026-09-28T21:30:00.000Z');
    expect(formatArrivalClock(arrival)).toBe('00:30');
  });

  it('formats clock times in Tallinn time whatever the device time zone', () => {
    // formatArrivalClock uses Europe/Tallinn explicitly, so this holds in any TZ
    const arrival = getArrivalDate(at(8, 12), { serviceDay: SERVICE_DAY }, tallinn(8, 0));
    expect(formatArrivalClock(arrival)).toBe('08:12');
  });
});

describe('without serviceDay (older cached data)', () => {
  it('still compares with the chosen time instead of now', () => {
    const planned = new Date();
    planned.setDate(planned.getDate() + 1);
    planned.setHours(8, 0, 0, 0);
    expect(shouldShowDeparture(at(7, 55), null, planned)).toBe(true);
    expect(formatArrivalTime(at(8, 12), null, planned)).toBe('12 min');
  });

  it('treats null as now', () => {
    const now = new Date();
    const inFiveMinutes = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + 5 * 60 + 30;
    expect(formatArrivalTime(inFiveMinutes, null, null)).toBe('5 min');
  });
});

describe('distances', () => {
  it('rounds metres to the nearest 10', () => {
    expect(roundMeters(4)).toBe(0);
    expect(roundMeters(5)).toBe(10);
    expect(roundMeters(123.4)).toBe(120);
    expect(roundMeters(336)).toBe(340);
  });

  it('formatDistance shows rounded metres and switches to km on the rounded value', () => {
    expect(formatDistance(224)).toBe('220 m');
    expect(formatDistance(994)).toBe('990 m');
    expect(formatDistance(996)).toBe('1.0 km');
    expect(formatDistance(1540)).toBe('1.5 km');
  });
});

describe('formatClockFromDate', () => {
  it('formats epoch ms and ISO strings as Tallinn clock time', () => {
    expect(formatClockFromDate(Date.UTC(2026, 9, 9, 11, 5))).toBe('14:05');
    expect(formatClockFromDate('2026-10-09T14:32:00+03:00')).toBe('14:32');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatClockFromDate(undefined)).toBe('');
    expect(formatClockFromDate('nope')).toBe('');
  });
});
