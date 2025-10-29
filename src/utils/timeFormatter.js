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

  // If the arrival time is in the past (earlier today), assume it's tomorrow
  if (arrivalTime < now) {
    arrivalTime.setDate(arrivalTime.getDate() + 1);
  }

  const minutesUntil = differenceInMinutes(arrivalTime, now);

  // Show "Arriving" for buses under 2 minutes (matching physical displays at stops)
  if (minutesUntil < 2) {
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
 * Keep departures visible for 2 minutes after scheduled time to match physical displays
 * @param {number} scheduledArrival - Seconds since midnight
 * @returns {boolean} - true if departure should be shown
 */
export function shouldShowDeparture(scheduledArrival) {
  const now = new Date();
  const arrivalTime = new Date();

  // Set the time based on seconds since midnight
  arrivalTime.setHours(0, 0, 0, 0);
  arrivalTime.setSeconds(scheduledArrival);

  // If the arrival time is in the past (earlier today), assume it's tomorrow
  if (arrivalTime < now) {
    arrivalTime.setDate(arrivalTime.getDate() + 1);
  }

  const minutesUntil = differenceInMinutes(arrivalTime, now);

  // Show departures that are up to 2 minutes in the past (to match "Arriving" display)
  // and all future departures
  return minutesUntil >= -2;
}
