// The app-wide route filter (a Set of route short names) applied to fetched stops

// A stop with only the picked routes' departures (the stop itself when no filter is set)
export function filterStopDepartures(stop, selectedRoutes) {
  if (!selectedRoutes || selectedRoutes.size === 0 || !stop.stoptimesWithoutPatterns) return stop;
  return {
    ...stop,
    stoptimesWithoutPatterns: stop.stoptimesWithoutPatterns.filter(dep => selectedRoutes.has(dep.trip?.route?.shortName))
  };
}

// Route names in the filter's order: numeric ones by number, then the rest alphabetically
export function sortRouteNames(names) {
  return [...names].sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.localeCompare(b);
  });
}
