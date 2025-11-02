import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';

/**
 * Format arrival time nicely (e.g., "2 min", "15:45")
 * @param {number} secondsSinceMidnight - Seconds since midnight (e.g., 43200 = 12:00 PM)
 */
export function formatArrivalTime(secondsSinceMidnight) {
  // Create a date object for today at the specified time
  const now = new Date();
  const arrivalTime = new Date();

  // Set the time based on seconds since midnight
  arrivalTime.setHours(0, 0, 0, 0); // Reset to midnight
  arrivalTime.setSeconds(secondsSinceMidnight); // Add seconds since midnight

  const minutesUntil = differenceInMinutes(arrivalTime, now);

  // If more than 12 hours in the past, it's probably tomorrow's departure
  // (e.g., it's 01:00 and bus was scheduled for 23:00 yesterday)
  if (minutesUntil < -720) {
    // It's tomorrow, adjust the date
    arrivalTime.setDate(arrivalTime.getDate() + 1);
    const adjustedMinutes = differenceInMinutes(arrivalTime, now);

    if (adjustedMinutes < 2) {
      return 'Arriving';
    } else if (adjustedMinutes < 60) {
      return `${adjustedMinutes} min`;
    } else {
      return format(arrivalTime, 'HH:mm');
    }
  }

  // Show "Late" for buses that are past their scheduled time (up to 12 hours)
  if (minutesUntil < 0) {
    return 'Late';
  }
  // Show "Arriving" for buses under 2 minutes (matching physical displays at stops)
  else if (minutesUntil < 2) {
    return 'Arriving';
  } else if (minutesUntil < 60) {
    return `${minutesUntil} min`;
  } else {
    return format(arrivalTime, 'HH:mm');
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
 * Keep departures visible for up to 10 minutes after scheduled time (for late buses)
 * @param {number} scheduledArrival - Seconds since midnight
 * @returns {boolean} - true if departure should be shown
 */
export function shouldShowDeparture(scheduledArrival) {
  const now = new Date();
  const arrivalTime = new Date();

  // Set the time based on seconds since midnight
  arrivalTime.setHours(0, 0, 0, 0);
  arrivalTime.setSeconds(scheduledArrival);

  const minutesUntil = differenceInMinutes(arrivalTime, now);

  // If more than 12 hours in the past, it's probably tomorrow's departure
  // (e.g., it's 01:00 and bus was scheduled for 23:00 yesterday)
  if (minutesUntil < -720) {
    return true; // It's tomorrow's departure, show it
  }

  // Show departures that are up to 10 minutes in the past (for late buses)
  // and all future departures
  return minutesUntil >= -10;
}

/**
 * Check if a departure is late (past its scheduled time)
 * @param {number} scheduledArrival - Seconds since midnight
 * @returns {boolean} - true if departure is late
 */
export function isDepartureLate(scheduledArrival) {
  const now = new Date();
  const arrivalTime = new Date();

  // Set the time based on seconds since midnight
  arrivalTime.setHours(0, 0, 0, 0);
  arrivalTime.setSeconds(scheduledArrival);

  const minutesUntil = differenceInMinutes(arrivalTime, now);

  // If more than 12 hours in the past, it's probably tomorrow's departure
  if (minutesUntil < -720) {
    return false; // It's tomorrow's departure, not late
  }

  // Late if past scheduled time (negative minutes)
  return minutesUntil < 0;
}
