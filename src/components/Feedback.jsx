import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import emailjs from '@emailjs/browser';

function Feedback() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      await emailjs.sendForm(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        e.target,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      setMessage(`✅ ${t('settings.feedbackSent')}`);
      setTimeout(() => {
        setIsOpen(false);
        setMessage('');
      }, 2000);
    } catch (error) {
      console.error('Failed to send feedback:', error);
      setMessage(`❌ ${t('settings.feedbackFailed')}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">{t('settings.feedback')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.feedbackDescription')}
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {t('settings.sendFeedback')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('settings.sendFeedback')}</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="user_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.name')} ({t('settings.optional')})
          </label>
          <input
            type="text"
            name="user_name"
            id="user_name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            placeholder={t('settings.namePlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="user_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.email')} ({t('settings.optional')})
          </label>
          <input
            type="email"
            name="user_email"
            id="user_email"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            placeholder={t('settings.emailPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.message')} <span className="text-red-500">*</span>
          </label>
          <textarea
            name="message"
            id="message"
            rows="4"
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-none"
            placeholder={t('settings.messagePlaceholder')}
          />
        </div>

        {message && (
          <div className={`text-sm font-medium ${message.startsWith('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={sending}
            className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? t('settings.sending') : t('settings.sendFeedback')}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('settings.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Feedback;
