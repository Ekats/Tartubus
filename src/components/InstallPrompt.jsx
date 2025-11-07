import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function InstallPrompt() {
  const { t } = useTranslation()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://')

    // Check if iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent)

    // Check if user dismissed prompt before
    const dismissed = localStorage.getItem('install_prompt_dismissed')

    // Show prompt if: iOS Safari, not installed, not previously dismissed
    if (isIOS && isSafari && !isStandalone && !dismissed) {
      // Wait 3 seconds before showing to not overwhelm user
      setTimeout(() => setShowPrompt(true), 3000)
    }
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('install_prompt_dismissed', 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-fade-in">
      <div className="bg-blue-600 text-white rounded-lg shadow-2xl p-4 border-2 border-blue-500">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/80 hover:text-white text-xl font-bold w-6 h-6 flex items-center justify-center"
          aria-label="Close"
        >
          ×
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="text-3xl">📱</div>
          <div>
            <h3 className="font-bold text-base mb-1">
              {t('install.title') || 'Install Tartubus'}
            </h3>
            <p className="text-sm text-white/90 mb-3">
              {t('install.description') || 'Add to your home screen for quick access'}
            </p>

            {/* Simple iOS instructions */}
            <div className="bg-white/20 backdrop-blur-sm rounded p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">1️⃣</span>
                <span>{t('install.step1') || 'Tap the Share button'}
                  <svg className="inline-block w-4 h-4 mx-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                  </svg>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">2️⃣</span>
                <span>{t('install.step2') || 'Select "Add to Home Screen"'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallPrompt
