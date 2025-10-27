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

  if (minutesUntil < 0) {
    return 'Now';
  } else if (minutesUntil < 1) {
    return '< 1 min';
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
