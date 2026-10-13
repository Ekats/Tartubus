// The stops of the Near Me bus whose route was tapped: the boarding and the last stop labelled with
// their times, the ones in between on tap.
import { useTranslation } from 'react-i18next';
import BusIcon from '../BusIcon';
import StopBoxesLayer from './StopBoxesLayer';

/** @param markers - tripView.markers from buildTripView (utils/tripRoute.js) */
function TripLayer({ markers, routeNumber, onLabelsDrawn }) {
  const { t } = useTranslation();
  const boxes = markers.map((m, i) => ({
    ...m,
    key: `trip-stop-${i}`,
    large: m.kind !== 'mid',
    permanent: m.kind !== 'mid',
    first: m.kind === 'first',
  }));

  return (
    <StopBoxesLayer
      id="trip"
      markers={boxes}
      onLabelsDrawn={onLabelsDrawn}
      renderBody={(m) => (
        <>
          <div className="font-bold journey-stop-name">{m.name}</div>
          <div className="text-amber-600 font-semibold">
            <BusIcon /> {routeNumber} {t('map.at')} {m.approx && '~'}{m.time}
          </div>
          {m.approx && <div className="text-gray-500 text-xs">{t('map.estimatedTime')}</div>}
          {m.kind === 'first' && <div className="text-green-600 text-xs font-semibold">📍 {t('map.boardHere')}</div>}
        </>
      )}
    />
  );
}

export default TripLayer;
