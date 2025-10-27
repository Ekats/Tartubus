import { useState, useEffect } from 'react';
import { formatArrivalTime } from '../utils/timeFormatter';

/**
 * Component that shows a live countdown timer for bus arrivals
 */
function CountdownTimer({ scheduledArrival }) {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    // Update immediately
    const updateTime = () => {
      setTimeString(formatArrivalTime(scheduledArrival));
    };

    updateTime();

    // Update every 10 seconds for efficiency
    const interval = setInterval(updateTime, 10000);

    return () => clearInterval(interval);
  }, [scheduledArrival]);

  return <>{timeString}</>;
}

export default CountdownTimer;
