import { useState, useEffect } from 'react';
import { formatArrivalTime } from '../utils/timeFormatter';
import { format, differenceInMinutes } from 'date-fns';

/**
 * Component that shows a live countdown timer for bus arrivals
 * Shows clock time subtitle when displaying "X min" countdown
 */
function CountdownTimer({ scheduledArrival }) {
  const [timeString, setTimeString] = useState('');
  const [clockTime, setClockTime] = useState('');
  const [showClockTime, setShowClockTime] = useState(false);

  useEffect(() => {
    // Update immediately
    const updateTime = () => {
      const formattedTime = formatArrivalTime(scheduledArrival);
      setTimeString(formattedTime);

      // Calculate if we should show clock time (when displaying "X min")
      const now = new Date();
      const arrivalTime = new Date();
      arrivalTime.setHours(0, 0, 0, 0);
      arrivalTime.setSeconds(scheduledArrival);

      const minutesUntil = differenceInMinutes(arrivalTime, now);

      // Adjust for tomorrow's departures
      if (minutesUntil < -720) {
        arrivalTime.setDate(arrivalTime.getDate() + 1);
      }

      // Show clock time only when displaying "X min" (2-59 minutes)
      // Don't show for "Arriving", clock times, or departed buses
      const isMinuteCountdown = formattedTime.includes('min') && !formattedTime.includes('Arriving');
      setShowClockTime(isMinuteCountdown);

      if (isMinuteCountdown) {
        setClockTime(format(arrivalTime, 'HH:mm'));
      }
    };

    updateTime();

    // Update every 10 seconds for efficiency
    const interval = setInterval(updateTime, 10000);

    return () => clearInterval(interval);
  }, [scheduledArrival]);

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
