import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';

/**
 * Format time as clock format only (e.g., "15:45")
 * Used for upcoming stops list where we always want clock time
 * @param {number} secondsSinceMidnight - Seconds since midnight (e.g., 43200 = 12:00 PM)
 */
export function formatClockTime(secondsSinceMidnight) {
  const hours = Math.floor(secondsSinceMidnight / 3600) % 24;
  const minutes = Math.floor((secondsSinceMidnight % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Clock times as shown on Tartu's stop displays, whatever the device's time zone
const TALLINN_CLOCK = new Intl.DateTimeFormat('et-EE', {
  timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/**
 * Absolute arrival time of a departure.
 * With `realtimeData.serviceDay` (the API's Unix timestamp, in seconds, of the service
 * date's local midnight) the result is exact, across midnight and in any device time zone.
 * Without it, falls back to the device clock: the reference day at N seconds after midnight,
 * where anything more than 12 hours before the reference time counts as the next day.
 * @param {number} secondsSinceMidnight - Scheduled seconds since midnight
 * @param {Object} realtimeData - Optional {realtimeArrival, realtime, serviceDay}
 * @param {Date|null} referenceTime - The time departures are compared with (the chosen time; null = now)
 * @returns {{date: Date, exact: boolean}}
 */
export function getArrivalDate(secondsSinceMidnight, realtimeData = null, referenceTime = null) {
  referenceTime = referenceTime || new Date();
  // Use real-time arrival if available, otherwise use scheduled
  const useRealtime = realtimeData?.realtime && realtimeData?.realtimeArrival != null;
  const actualArrival = useRealtime ? realtimeData.realtimeArrival : secondsSinceMidnight;

  if (realtimeData?.serviceDay) {
    return { date: new Date((realtimeData.serviceDay + actualArrival) * 1000), exact: true };
  }

  const date = new Date(referenceTime);
  date.setHours(0, 0, 0, 0);
  date.setSeconds(actualArrival);
  // More than 12 hours in the past: it's the next day's departure
  // (e.g., it's 01:00 and bus was scheduled for 23:00)
  if (differenceInMinutes(date, referenceTime) < -720) {
    date.setDate(date.getDate() + 1);
  }
  return { date, exact: false };
}

/**
 * Clock time ("08:12") of an arrival from getArrivalDate()
 */
export function formatArrivalClock({ date, exact }) {
  return exact ? TALLINN_CLOCK.format(date) : format(date, 'HH:mm');
}

/**
 * Format arrival time nicely (e.g., "2 min", "15:45")
 * Uses real-time arrival data when available, falls back to scheduled time
 * @param {number} secondsSinceMidnight - Scheduled seconds since midnight (e.g., 43200 = 12:00 PM)
 * @param {Object} realtimeData - Optional realtime data {realtimeArrival, realtime, serviceDay}
 * @param {Date|null} referenceTime - The time to count down from (null = now)
 */
export function formatArrivalTime(secondsSinceMidnight, realtimeData = null, referenceTime = null) {
  referenceTime = referenceTime || new Date();
  const arrival = getArrivalDate(secondsSinceMidnight, realtimeData, referenceTime);
  const minutesUntil = differenceInMinutes(arrival.date, referenceTime);

  // Show clock time for buses that are past their scheduled time (up to 12 hours)
  if (minutesUntil < 0) {
    return formatArrivalClock(arrival);
  }
  // Show "Arriving" for buses under 2 minutes (matching physical displays at stops)
  else if (minutesUntil < 2) {
    return 'Arriving';
  } else if (minutesUntil < 60) {
    return `${minutesUntil} min`;
  } else {
    return formatArrivalClock(arrival);
  }
}

/**
 * Format duration in seconds to readable format
 */
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format distance in meters to readable format
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Check if a departure should still be visible (not too far in the past)
 * Keep departures visible for up to 10 minutes after scheduled time (for departed buses)
 * @param {number} scheduledArrival - Seconds since midnight
 * @param {Object} realtimeData - Optional realtime data {realtimeArrival, realtime, serviceDay}
 * @param {Date|null} referenceTime - The time departures are compared with (null = now)
 * @returns {boolean} - true if departure should be shown
 */
export function shouldShowDeparture(scheduledArrival, realtimeData = null, referenceTime = null) {
  referenceTime = referenceTime || new Date();
  const { date } = getArrivalDate(scheduledArrival, realtimeData, referenceTime);

  // Show departures that are up to 10 minutes in the past (for departed buses)
  // and all future departures
  return differenceInMinutes(date, referenceTime) >= -10;
}

/**
 * Check if a departure is late (past its scheduled time)
 * @param {number} scheduledArrival - Seconds since midnight
 * @param {Object} realtimeData - Optional realtime data {realtimeArrival, realtime, serviceDay}
 * @param {Date|null} referenceTime - The time departures are compared with (null = now)
 * @returns {boolean} - true if departure is late
 */
export function isDepartureLate(scheduledArrival, realtimeData = null, referenceTime = null) {
  referenceTime = referenceTime || new Date();
  const { date } = getArrivalDate(scheduledArrival, realtimeData, referenceTime);

  // Late if past scheduled time (negative minutes)
  return differenceInMinutes(date, referenceTime) < 0;
}

/**
 * Get delay information for display
 * @param {number} scheduledArrival - Scheduled seconds since midnight
 * @param {Object} realtimeData - Realtime data {realtimeArrival, arrivalDelay, realtime}
 * @returns {Object|null} - {minutes: number, isLate: boolean} or null if no delay
 */
export function getDelayInfo(scheduledArrival, realtimeData) {
  if (!realtimeData?.realtime || realtimeData?.arrivalDelay == null) {
    return null;
  }

  const delaySeconds = realtimeData.arrivalDelay;
  const delayMinutes = Math.round(delaySeconds / 60);

  // Only show if delay is significant (more than 1 minute)
  if (Math.abs(delayMinutes) < 1) {
    return null;
  }

  return {
    minutes: Math.abs(delayMinutes),
    isLate: delayMinutes > 0
  };
}
