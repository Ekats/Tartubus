// A planned journey ("how to get here"): a line per leg - walking green and dashed, the bus blue -
// and the stops of its bus legs: where to board, change and get off labelled, the rest on tap.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { decodePolyline } from '../../services/digitransit';
import { journeyLines, journeyStops, lineCollection } from '../../utils/mapFeatures';
import BusIcon from '../BusIcon';
import { useGeoJsonLayers, ABOVE_LINES } from './mapContext';
import StopBoxesLayer from './StopBoxesLayer';

const SOURCE = 'journey-lines';
const paint = { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.8 };
const LAYERS = [
  { id: 'journey-line', type: 'line', filter: ['!', ['get', 'dashed']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint },
  // 8 px on, 8 px off on a 4 px line (dashes are counted in line widths)
  { id: 'journey-line-walk', type: 'line', filter: ['get', 'dashed'], layout: { 'line-join': 'round' }, paint: { ...paint, 'line-dasharray': [2, 2] } },
];

function JourneyBody({ m }) {
  const { t } = useTranslation();
  const name = <div className="font-bold journey-stop-name">{m.name}</div>;
  // A label that is always shown and the box of a tapped stop differ slightly in their last line
  const small = m.permanent ? '' : ' text-xs font-semibold';

  if (m.kind === 'board') {
    return (
      <>
        {name}
        <div className={`text-amber-600${m.permanent ? '' : ' font-semibold'}`}><BusIcon /> {m.route} {t('map.at')} {m.time}</div>
        <div className={`text-green-600${small}`}>📍 {t('map.boardHere')}</div>
      </>
    );
  }
  if (m.kind === 'mid') {
    return (
      <>
        {name}
        <div className="text-amber-600 font-semibold"><BusIcon /> {m.route} ~{m.time}</div>
        <div className="text-gray-500 text-xs">{t('map.estimatedTime')}</div>
      </>
    );
  }
  if (m.kind === 'transfer') {
    return (
      <>
        {name}
        <div className="text-orange-600">⬇️ {t('map.getOff')} <BusIcon /> {m.route} {t('map.at')} {m.time}</div>
        <div className="text-green-600">⬆️ {t('map.board')} <BusIcon /> {m.nextRoute} {t('map.at')} {m.nextTime}</div>
      </>
    );
  }
  return (
    <>
      {name}
      <div className={`text-amber-600${m.permanent ? '' : ' font-semibold'}`}><BusIcon /> {m.route} {t('map.arrives')} {m.time}</div>
      <div className={`text-red-600${small}`}>📍 {m.last ? t('map.getOffHere') : t('map.stop')}</div>
    </>
  );
}

function JourneyLayer({ journey, onLabelsDrawn }) {
  const lines = useMemo(() => lineCollection(journeyLines(journey, decodePolyline)), [journey]);
  const stops = useMemo(() => journeyStops(journey), [journey]);

  useGeoJsonLayers({ sourceId: SOURCE, data: lines, layers: LAYERS, below: ABOVE_LINES });

  return <StopBoxesLayer id="journey" markers={stops} renderBody={(m) => <JourneyBody m={m} />} onLabelsDrawn={onLabelsDrawn} />;
}

export default JourneyLayer;
