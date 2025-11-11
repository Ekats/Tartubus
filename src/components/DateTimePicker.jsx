import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

function DateTimePicker({ isOpen, onClose, customTime, onTimeChange }) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Initialize form values when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = customTime || new Date();
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const dateStr = format(now, "yyyy-MM-dd");
      const timeStr = format(now, "HH:mm");
      setSelectedDate(dateStr);
      setSelectedTime(timeStr);
    }
  }, [isOpen, customTime]);

  // Adjust time by minutes
  const adjustTime = (minutes) => {
    if (!selectedTime) return;
    const [hours, mins] = selectedTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins + minutes);
    const newTimeStr = format(date, "HH:mm");
    setSelectedTime(newTimeStr);
  };

  // Format the current selection for display
  const getFormattedSelection = () => {
    if (!selectedDate || !selectedTime) return '';
    try {
      const dateTime = new Date(`${selectedDate}T${selectedTime}`);
      return format(dateTime, 'EEEE, MMMM d, yyyy • HH:mm');
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedDate && selectedTime) {
      const dateTime = new Date(`${selectedDate}T${selectedTime}`);
      onTimeChange(dateTime);
      onClose();
    }
  };

  const handleUseNow = () => {
    onTimeChange(null); // null = use current time
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-primary dark:bg-gray-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('timePicker.title')}
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Selection Display */}
          {getFormattedSelection() && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl p-4 text-center shadow-lg">
              <p className="text-xs text-blue-100 dark:text-blue-200 font-medium uppercase tracking-wide mb-1">
                {t('timePicker.viewing')}
              </p>
              <p className="text-xl font-bold text-white">
                {getFormattedSelection()}
              </p>
            </div>
          )}

          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('timePicker.date')}
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-4 pr-16 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                style={{
                  fontSize: '16px',
                  colorScheme: 'light dark'
                }}
              />
              {/* Custom calendar button overlay */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <div className="p-2 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/30">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Time Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('timePicker.time')}
            </label>
            <div className="space-y-3">
              {/* Time input field */}
              <div className="relative">
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-4 py-4 pr-16 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  style={{
                    fontSize: '16px',
                    colorScheme: 'light dark'
                  }}
                />
                {/* Custom clock button overlay */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="p-2 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/30">
                    <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Time adjustment buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => adjustTime(-30)}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  -30 min
                </button>
                <button
                  onClick={() => adjustTime(-15)}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  -15 min
                </button>
                <button
                  onClick={() => adjustTime(15)}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  +15 min
                </button>
                <button
                  onClick={() => adjustTime(30)}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  +30 min
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleUseNow}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('timePicker.useNow')}
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedDate || !selectedTime}
              className="flex-1 px-4 py-3 rounded-lg bg-primary hover:bg-primary-dark dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('timePicker.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DateTimePicker;
