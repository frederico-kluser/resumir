import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingStatusProps {
  transcriptLength: number;
  isActive: boolean;
}

// The Sims-style loading messages
const LOADING_MESSAGE_KEYS = [
  'loading.readingText',
  'loading.understandingContext',
  'loading.identifyingTopics',
  'loading.extractingKeyPoints',
  'loading.analyzingContent',
  'loading.findingHighlights',
  'loading.summarizingIdeas',
  'loading.connectingDots',
  'loading.organizingThoughts',
  'loading.polishingResult',
  'loading.almostThere',
  'loading.finalTouches'
] as const;

// Calculate display time based on transcript length
// Min: 2000ms, Max: 5000ms
const calculateMessageDuration = (transcriptLength: number): number => {
  // Base thresholds for transcript length
  const MIN_TRANSCRIPT = 500;   // Short video ~1 min
  const MAX_TRANSCRIPT = 10000; // Long video ~30+ min

  const MIN_DURATION = 2000; // 2 seconds
  const MAX_DURATION = 5000; // 5 seconds

  // Clamp transcript length to our range
  const clampedLength = Math.max(MIN_TRANSCRIPT, Math.min(MAX_TRANSCRIPT, transcriptLength));

  // Linear interpolation between min and max duration
  const ratio = (clampedLength - MIN_TRANSCRIPT) / (MAX_TRANSCRIPT - MIN_TRANSCRIPT);
  return Math.round(MIN_DURATION + ratio * (MAX_DURATION - MIN_DURATION));
};

export const LoadingStatus: React.FC<LoadingStatusProps> = ({ transcriptLength, isActive }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const messageDuration = useMemo(
    () => calculateMessageDuration(transcriptLength),
    [transcriptLength]
  );

  // Reset index when loading starts
  useEffect(() => {
    if (isActive) {
      setCurrentIndex(0);
      setIsVisible(true);
    }
  }, [isActive]);

  // Rotate through messages
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);

      // After fade out, change message and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % LOADING_MESSAGE_KEYS.length);
        setIsVisible(true);
      }, 200); // Fade transition duration
    }, messageDuration);

    return () => clearInterval(interval);
  }, [isActive, messageDuration]);

  if (!isActive) return null;

  const currentMessageKey = LOADING_MESSAGE_KEYS[currentIndex];
  const currentMessage = t(currentMessageKey);

  return (
    <div className="flex items-center justify-center py-2">
      <div
        className={`
          text-sm text-gray-500 dark:text-gray-400 italic text-center
          transition-opacity duration-200 ease-in-out
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></span>
          {currentMessage}
        </span>
      </div>
    </div>
  );
};

export default LoadingStatus;
