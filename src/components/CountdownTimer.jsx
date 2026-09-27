import { useState, useEffect } from 'react';
import { formatArrivalTime, getArrivalDate, formatArrivalClock } from '../utils/timeFormatter';
import { differenceInMinutes } from 'date-fns';

/**
 * Component that shows a live countdown timer for bus arrivals
 * Shows clock time subtitle when displaying "X min" countdown
 * Uses real-time arrival data when available
 * With a planned `referenceTime` (a time the user picked), shows the clock time and
 * "+N min" from that time instead of a live countdown.
 */
function CountdownTimer({ scheduledArrival, realtimeData = null, referenceTime = null }) {
  const [timeString, setTimeString] = useState('');
  const [clockTime, setClockTime] = useState('');
  const [showClockTime, setShowClockTime] = useState(false);

  useEffect(() => {
    if (referenceTime) {
      // Planned time: nothing to count down, show when the bus comes relative to the chosen time
      const arrival = getArrivalDate(scheduledArrival, realtimeData, referenceTime);
      const minutesAfter = differenceInMinutes(arrival.date, referenceTime);
      setTimeString(formatArrivalClock(arrival));
      setClockTime(minutesAfter >= 0 ? `+${minutesAfter} min` : '');
      setShowClockTime(minutesAfter >= 0);
      return;
    }

    // Update immediately
    const updateTime = () => {
      const now = new Date();
      const formattedTime = formatArrivalTime(scheduledArrival, realtimeData, now);
      setTimeString(formattedTime);

      // Show clock time only when displaying "X min" (2-59 minutes)
      // Don't show for "Arriving", clock times, or departed buses
      const isMinuteCountdown = formattedTime.includes('min') && !formattedTime.includes('Arriving');
      setShowClockTime(isMinuteCountdown);

      if (isMinuteCountdown) {
        setClockTime(formatArrivalClock(getArrivalDate(scheduledArrival, realtimeData, now)));
      }
    };

    updateTime();

    // Update every 10 seconds for efficiency
    const interval = setInterval(updateTime, 10000);

    return () => clearInterval(interval);
  }, [scheduledArrival, realtimeData, referenceTime]);

  if (showClockTime) {
    return (
      <>
        <span className="block">{timeString}</span>
        <span className="block text-xs opacity-60">{clockTime}</span>
      </>
    );
  }

  return <>{timeString}</>;
}

export default CountdownTimer;
