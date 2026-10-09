import { useTranslation } from 'react-i18next';
import { formatClockFromDate } from '../utils/timeFormatter';

/**
 * One line saying the departures shown are a last-known copy, not from this refresh.
 * `since`: epoch ms the data was fetched; nothing is rendered without it.
 */
function StaleNotice({ since }) {
  const { t } = useTranslation();
  if (!since) return null;
  return (
    <div className="mt-4 mb-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
      {t('offline.staleData', { time: formatClockFromDate(since) })}
    </div>
  );
}

export default StaleNotice;
