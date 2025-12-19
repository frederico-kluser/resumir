import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const ONBOARDING_STORAGE_PREFIX = 'resumir.onboarding.';

interface OnboardingModalProps {
  id: string;
  children: React.ReactNode;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ id, children, onClose }) => {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const storageKey = `${ONBOARDING_STORAGE_PREFIX}${id}`;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch (e) {
        console.warn('Failed to save onboarding preference:', e);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {children}

        {/* Footer with checkbox and button */}
        <div className="px-6 pb-6 pt-2">
          <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('onboarding.dontShowAgain')}
            </span>
          </label>

          <button
            onClick={handleClose}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            {t('onboarding.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Check if an onboarding modal should be shown
 */
export const shouldShowOnboarding = (id: string): boolean => {
  try {
    const storageKey = `${ONBOARDING_STORAGE_PREFIX}${id}`;
    return localStorage.getItem(storageKey) !== 'true';
  } catch {
    return true;
  }
};

/**
 * Welcome Modal - shown on first extension open
 */
export const WelcomeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <OnboardingModal id="welcome" onClose={onClose}>
      <div className="p-6 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('onboarding.welcome.title')}
        </h2>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('onboarding.welcome.description')}
        </p>

        {/* Steps */}
        <div className="text-left space-y-3 mb-2">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
              1
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('onboarding.welcome.step1')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
              2
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('onboarding.welcome.step2')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
              3
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('onboarding.welcome.step3')}
            </p>
          </div>
        </div>
      </div>
    </OnboardingModal>
  );
};

/**
 * Summary Instructions Modal - shown when user reaches the summarize screen
 */
export const SummaryInstructionsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <OnboardingModal id="summary-instructions" onClose={onClose}>
      <div className="p-6 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('onboarding.summary.title')}
        </h2>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('onboarding.summary.description')}
        </p>

        {/* Tips */}
        <div className="text-left space-y-3 mb-2">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('onboarding.summary.tip1')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('onboarding.summary.tip2')}
            </p>
          </div>
        </div>
      </div>
    </OnboardingModal>
  );
};
