// The box of a stop tapped on the map: its name and code and the next few departures, in the look of
// the trip / journey stop boxes. A tap on the box opens the stop's full view; its × closes it.
import { useTranslation } from 'react-i18next';
import { shouldShowDeparture, formatArrivalTime } from '../../utils/timeFormatter';
import MapMarker from './MapMarker';

const SHOWN_DEPARTURES = 3;

/**
 * @param stop - { lat, lon, name, code } where the stop's icon is drawn
 * @param iconSize - the icon's height in pixels: the box's pointer ends at its top edge
 * @param departures - the stop's stoptimesWithoutPatterns, or null while they load
 * @param onOpen() - a tap on the box
 * @param onClose() - a tap on its ×
 */
function StopPopup({ stop, iconSize, departures, customTime, onOpen, onClose }) {
  const { t } = useTranslation();
  const upcoming = (departures || [])
    .filter(dep => shouldShowDeparture(dep.scheduledArrival, dep, customTime))
    .slice(0, SHOWN_DEPARTURES);

  return (
    <MapMarker
      lat={stop.lat}
      lon={stop.lon}
      anchor="bottom"
      offset={[0, -(iconSize / 2) - 6]}
      className="journey-stop-box journey-stop-tapped map-stop-popup"
      zIndex={30}
      onClick={(e) => (e.target.closest('.journey-stop-close') ? onClose() : onOpen())}
    >
      <div className="text-xs font-semibold">
        <div className="font-bold journey-stop-name">
          {stop.name}{stop.code && <span className="text-gray-500 font-normal"> {stop.code}</span>}
        </div>
        {departures === null ? (
          <div className="text-gray-500 font-normal">{t('common.loading')}</div>
        ) : upcoming.length === 0 ? (
          <div className="text-gray-500 font-normal">{t('nearMe.noDepartures')}</div>
        ) : (
          upcoming.map((dep, i) => (
            <div key={i} className="map-stop-popup-row">
              <span className="map-stop-popup-route">{dep.trip?.route?.shortName || '?'}</span>
              <span className="map-stop-popup-headsign">{dep.headsign}</span>
              <span>{formatArrivalTime(dep.scheduledArrival, dep, customTime)}</span>
            </div>
          ))
        )}
      </div>
      <button type="button" className="journey-stop-close" aria-label={t('common.close')}>×</button>
    </MapMarker>
  );
}

export default StopPopup;
