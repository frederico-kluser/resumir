import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
}

/**
 * Maps 2-letter ISO 639-1 language codes to BCP 47 language tags
 * for better voice matching with the Web Speech API
 */
const LANGUAGE_TO_BCP47: Record<string, string[]> = {
  en: ['en-US', 'en-GB', 'en-AU', 'en'],
  zh: ['zh-CN', 'zh-TW', 'zh-HK', 'zh'],
  hi: ['hi-IN', 'hi'],
  es: ['es-ES', 'es-MX', 'es-US', 'es'],
  fr: ['fr-FR', 'fr-CA', 'fr'],
  ar: ['ar-SA', 'ar-EG', 'ar'],
  bn: ['bn-BD', 'bn-IN', 'bn'],
  pt: ['pt-BR', 'pt-PT', 'pt'],
  ru: ['ru-RU', 'ru'],
  id: ['id-ID', 'id'],
};

/**
 * Find the best matching voice for a given language code
 */
const findVoiceForLanguage = (
  voices: SpeechSynthesisVoice[],
  langCode: string
): SpeechSynthesisVoice | null => {
  if (voices.length === 0) return null;

  // Get preferred BCP 47 codes for this language
  const preferredCodes = LANGUAGE_TO_BCP47[langCode] || [langCode];

  // Try to find a voice matching our preferred codes (in order of preference)
  for (const code of preferredCodes) {
    // First try exact match
    const exactMatch = voices.find(
      (v) => v.lang.toLowerCase() === code.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Then try prefix match (e.g., 'en' matches 'en-US')
    const prefixMatch = voices.find(
      (v) => v.lang.toLowerCase().startsWith(code.toLowerCase())
    );
    if (prefixMatch) return prefixMatch;
  }

  // Fallback: try to find any voice that starts with the language code
  const fallbackMatch = voices.find((v) =>
    v.lang.toLowerCase().startsWith(langCode.toLowerCase())
  );
  if (fallbackMatch) return fallbackMatch;

  // Last resort: return the first available voice
  return voices[0];
};

/**
 * Hook for using the Web Speech Synthesis API (Text-to-Speech)
 * Uses the native browser API available in Chrome and other modern browsers
 */
export const useSpeechSynthesis = (
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn => {
  const { lang = 'en', rate = 1, pitch = 1, volume = 1 } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if speech synthesis is supported
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    // Load voices immediately (works in Firefox/Safari)
    loadVoices();

    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
      }
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;

      // Cancel any ongoing speech
      stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Find the best voice for the selected language
      const selectedVoice = findVoiceForLanguage(voices, lang);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        // Fallback to setting just the language
        utterance.lang = lang;
      }

      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onstart = () => {
        setIsSpeaking(true);

        // Chrome bug workaround: long texts pause after ~15 seconds
        // Resume periodically to prevent this
        resumeIntervalRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 10000);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
      };

      utterance.onerror = (event) => {
        // Don't log 'interrupted' errors as they're expected when stopping
        if (event.error !== 'interrupted') {
          console.warn('Speech synthesis error:', event.error);
        }
        setIsSpeaking(false);
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voices, lang, rate, pitch, volume, stop]
  );

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    voices,
  };
};
