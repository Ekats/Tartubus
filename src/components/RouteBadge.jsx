import { useTranslation } from 'react-i18next';

// A departure row's route number. With onShowRoute it is a button that shows the bus on the map
export default function RouteBadge({ routeShortName, isLate, onShowRoute }) {
  const { t } = useTranslation();
  const badgeColor = isLate ? 'bg-gray-400 dark:bg-gray-600' : 'bg-primary dark:bg-blue-600';

  if (routeShortName && onShowRoute) {
    return (
      <button
        onClick={onShowRoute}
        className={`${badgeColor} hover:opacity-80 min-w-[44px] min-h-[44px] px-3 flex items-center justify-center shrink-0 text-white font-bold rounded-md text-sm`}
        aria-label={`${t('nearMe.showRouteOnMap')}: ${routeShortName}`}
        title={t('nearMe.showRouteOnMap')}
      >
        {routeShortName}
      </button>
    );
  }
  return (
    <div className={`${badgeColor} text-white font-bold px-3 py-1 min-w-[3rem] text-center shrink-0 rounded-md text-sm`}>
      {routeShortName || '?'}
    </div>
  );
}
