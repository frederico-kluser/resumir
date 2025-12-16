import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from './components/Logo';
import { Button, Card, TimestampBadge } from './components/Components';
import { LoadingStatus } from './components/LoadingStatus';
import { ErrorModal } from './components/ErrorModal';
import { Toast } from './components/Toast';
import { ThemeSelector } from './components/ThemeSelector';
import { AudioPlayButton } from './components/AudioPlayButton';
import { useTheme } from './hooks/useTheme';
import { analyzeVideo, answerUserQuestion, improveResult } from './services/geminiService';
import { getUserApiKey, saveUserApiKey, clearUserApiKey } from './services/apiKeyStorage';
import { getSummary, saveSummary, extractVideoId, StoredSummary } from './services/summaryStorage';
import { buildOfflinePrompt, storePendingPrompt, copyToClipboard, openDeepSeekChat } from './services/offlinePromptService';
import { getFullTranscriptText } from './mockData';
import { AnalysisResult, AppState } from './types';
import { LANGUAGE_OPTIONS } from './i18n';

const LANGUAGE_STORAGE_KEY = 'tubegist.language';
const SUPPORTED_LANGUAGE_CODES = new Set(LANGUAGE_OPTIONS.map(({ code }) => code));

// Timeout and retry configuration for initial summary generation
const SUMMARY_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3; // Total attempts (1 original + 2 retries)

declare var chrome: any;

// Custom error class for timeout errors
class TimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TimeoutError';
	}
}

// Helper function to execute a promise with timeout
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> => {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new TimeoutError(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
		}, timeoutMs);

		promise
			.then((result) => {
				clearTimeout(timeoutId);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
};

// Helper function to execute with timeout and retry
const withTimeoutAndRetry = async <T,>(
	operation: () => Promise<T>,
	timeoutMs: number,
	maxAttempts: number,
	operationName: string,
	onRetry?: (attempt: number, error: Error) => void,
): Promise<T> => {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await withTimeout(operation(), timeoutMs, operationName);
		} catch (error) {
			lastError = error as Error;

			// Check if it's a timeout or network error (retryable)
			const isRetryable =
				error instanceof TimeoutError ||
				(error as any)?.message?.toLowerCase().includes('network') ||
				(error as any)?.message?.toLowerCase().includes('fetch') ||
				(error as any)?.message?.toLowerCase().includes('connection') ||
				(error as any)?.name === 'TypeError'; // Often network errors

			if (isRetryable && attempt < maxAttempts) {
				console.warn(`Attempt ${attempt}/${maxAttempts} failed for ${operationName}:`, error);
				onRetry?.(attempt, error as Error);
				// Small delay before retry to avoid hammering the API
				await new Promise((resolve) => setTimeout(resolve, 500));
				continue;
			}

			// Non-retryable error or max attempts reached
			throw error;
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError || new Error('Unknown error');
};

type NullableBoolean = boolean | null;

const normalizeLanguage = (value?: string | null) => {
	if (!value) return null;
	const base = value.toLowerCase().split('-')[0];
	return SUPPORTED_LANGUAGE_CODES.has(base) ? base : null;
};

const detectLanguageFromEnv = () => {
	const chromeLang = typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage?.();
	const navigatorLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
	return normalizeLanguage(chromeLang) ?? normalizeLanguage(navigatorLang) ?? 'en';
};

const TIMESTAMP_REGEX = /(?:\d{1,2}:){1,2}\d{2}/;

const parseTimestampToSeconds = (value: string): number | null => {
	if (!value) {
		return null;
	}

	const match = value.match(TIMESTAMP_REGEX);
	if (!match) {
		return null;
	}

	const parts = match[0].split(':').map((segment) => Number(segment));
	if (parts.some((segment) => Number.isNaN(segment))) {
		return null;
	}

	return parts.reduce((acc, segment) => acc * 60 + segment, 0);
};

export default function App() {
	const { t, i18n } = useTranslation();
	const { theme, setTheme } = useTheme();
	const [userQuery, setUserQuery] = useState('');
	const [status, setStatus] = useState<AppState>(AppState.IDLE);
	const [result, setResult] = useState<AnalysisResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [isYoutube, setIsYoutube] = useState(false);
	const [currentTabId, setCurrentTabId] = useState<number | null>(null);
	const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
	const [checkingTab, setCheckingTab] = useState(true);

	const [apiKey, setApiKey] = useState<string | null>(null);
	const [apiKeyInput, setApiKeyInput] = useState('');
	const [savingKey, setSavingKey] = useState(false);
	const [keySetupError, setKeySetupError] = useState<string | null>(null);
	const [keySetupSuccess, setKeySetupSuccess] = useState<string | null>(null);
	const [checkingKey, setCheckingKey] = useState(true);

	const [language, setLanguage] = useState('en');
	const [hasCaptions, setHasCaptions] = useState<NullableBoolean>(null);
	const [checkingCaptions, setCheckingCaptions] = useState(false);
	const [transcriptLength, setTranscriptLength] = useState(0);
	const [showSwitchKeyModal, setShowSwitchKeyModal] = useState(false);
	const [loadingFromCache, setLoadingFromCache] = useState(false);
	const [isFromCache, setIsFromCache] = useState(false);
	const [showErrorModal, setShowErrorModal] = useState(false);
	const [errorDetails, setErrorDetails] = useState<string | null>(null);
	const [isCommunicationError, setIsCommunicationError] = useState(false);
	const [isImproving, setIsImproving] = useState(false);
	const [currentTranscript, setCurrentTranscript] = useState<string>('');
	const [showAudioApiKeyModal, setShowAudioApiKeyModal] = useState(false);
	const [offlineStatus, setOfflineStatus] = useState<string | null>(null);
	const [isOfflineLoading, setIsOfflineLoading] = useState(false);
	const [retryAttempt, setRetryAttempt] = useState(0);

	const inputRef = useRef<HTMLTextAreaElement>(null);

	const selectedLanguageOption = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

	const handleLanguageChange = (nextCode: string) => {
		const normalized = normalizeLanguage(nextCode) ?? 'en';
		setLanguage(normalized);
		i18n.changeLanguage(normalized);
		if (typeof window !== 'undefined') {
			try {
				window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
			} catch (storageError) {
				console.warn('Failed to persist language selection', storageError);
			}
		}
	};

	const LanguagePicker: React.FC<{ id: string; className?: string }> = ({ id, className = '' }) => (
		<select
			id={id}
			value={language}
			onChange={(event) => handleLanguageChange(event.target.value)}
			className={`text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer ${className}`}
		>
			{LANGUAGE_OPTIONS.map((option) => (
				<option key={option.code} value={option.code}>
					{option.flag} {option.name}
				</option>
			))}
		</select>
	);

	// Initialize language preference
	useEffect(() => {
		const initLanguage = () => {
			let stored: string | null = null;
			if (typeof window !== 'undefined') {
				try {
					stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
				} catch (storageError) {
					console.warn('Failed to read stored language', storageError);
				}
			}
			const resolved = normalizeLanguage(stored) ?? detectLanguageFromEnv();
			setLanguage(resolved);
			i18n.changeLanguage(resolved);
			if (typeof window !== 'undefined') {
				try {
					window.localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
				} catch (storageError) {
					console.warn('Failed to persist resolved language', storageError);
				}
			}
		};

		initLanguage();
	}, [i18n]);

	// 1. Check for API Key on Mount
	useEffect(() => {
		let active = true;

		const loadKey = async () => {
			try {
				const stored = await getUserApiKey();
				if (!active) return;
				if (stored) {
					setApiKey(stored);
					return;
				}

				if (window.aistudio?.getSelectedApiKey) {
					const selected = await window.aistudio.getSelectedApiKey();
					if (!active) return;
					if (selected) {
						await saveUserApiKey(selected);
						if (!active) return;
						setApiKey(selected);
						return;
					}
				}
			} catch (e) {
				console.error('Failed to check API key', e);
			} finally {
				if (active) {
					setCheckingKey(false);
				}
			}
		};

		loadKey();

		return () => {
			active = false;
		};
	}, []);

	// 2. Check tab status
	useEffect(() => {
		const checkCurrentTab = () => {
			if (typeof chrome === 'undefined' || !chrome.tabs) {
				setCheckingTab(false);
				setIsYoutube(false);
				return;
			}

			chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
				const tab = tabs[0];
				const isYt = tab?.url?.includes('youtube.com/watch') || false;
				setIsYoutube(isYt);
				if (isYt) {
					setCurrentTabId(tab.id);
					setCurrentVideoUrl(tab.url || null);
				} else {
					setCurrentVideoUrl(null);
				}
				setCheckingTab(false);
			});
		};

		checkCurrentTab();

		const handleUpdate = (_tabId: number, changeInfo: any) => {
			if (changeInfo.status === 'complete' || changeInfo.url) {
				checkCurrentTab();
			}
		};

		const handleActivated = () => {
			checkCurrentTab();
		};

		if (typeof chrome !== 'undefined' && chrome.tabs) {
			chrome.tabs.onUpdated.addListener(handleUpdate);
			chrome.tabs.onActivated.addListener(handleActivated);
		}

		return () => {
			if (typeof chrome !== 'undefined' && chrome.tabs) {
				chrome.tabs.onUpdated.removeListener(handleUpdate);
				chrome.tabs.onActivated.removeListener(handleActivated);
			}
		};
	}, []);

	// 3. Focus textarea when ready
	useEffect(() => {
		if (isYoutube && apiKey && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isYoutube, apiKey]);

	// 4. Caption availability check + Load cached summary
	// Note: currentVideoUrl is included in deps to re-check captions when navigating
	// to a different video within the same tab (e.g., clicking on suggested videos)
	useEffect(() => {
		let active = true;

		// Reset state when video changes
		setResult(null);
		setError(null);
		setStatus(AppState.IDLE);
		setIsFromCache(false);

		if (!isYoutube || !currentTabId || typeof chrome === 'undefined' || !chrome.tabs) {
			setHasCaptions(null);
			setCheckingCaptions(false);
			setLoadingFromCache(false);
			return () => {
				active = false;
			};
		}

		// Try to load cached summary
		const videoId = extractVideoId(currentVideoUrl);
		if (videoId) {
			setLoadingFromCache(true);
			getSummary(videoId)
				.then((cached: StoredSummary | null) => {
					if (!active) return;
					if (cached) {
						setResult(cached.result);
						setUserQuery(cached.userQuery || '');
						setStatus(AppState.SUCCESS);
						setIsFromCache(true);
					}
				})
				.catch((err) => {
					console.warn('Failed to load cached summary:', err);
				})
				.finally(() => {
					if (active) {
						setLoadingFromCache(false);
					}
				});
		}

		// Check captions availability
		setCheckingCaptions(true);
		setHasCaptions(null);

		chrome.tabs.sendMessage(currentTabId, { action: 'CHECK_CAPTIONS' }, (response: any) => {
			if (!active) return;
			setCheckingCaptions(false);

			if (typeof chrome !== 'undefined' && chrome.runtime?.lastError) {
				console.warn('Caption status unavailable:', chrome.runtime.lastError.message);
				setHasCaptions(null);
				return;
			}

			if (response?.success) {
				setHasCaptions(Boolean(response.hasCaptions));
			} else {
				setHasCaptions(null);
			}
		});

		return () => {
			active = false;
		};
	}, [isYoutube, currentTabId, currentVideoUrl]);

	const persistApiKey = async (key: string) => {
		const trimmed = key.trim();
		if (!trimmed) {
			throw new Error(t('auth.errorMissing'));
		}
		await saveUserApiKey(trimmed);
		setApiKey(trimmed);
		setKeySetupError(null);
		setKeySetupSuccess(t('auth.successMessage'));
	};

	const handleLanguageAwareError = (message: string, details?: string, communicationError = false) => {
		setStatus(AppState.ERROR);
		setError(message);
		setErrorDetails(details || null);
		setIsCommunicationError(communicationError);
		setShowErrorModal(true);
	};

	const handleCloseErrorModal = () => {
		setShowErrorModal(false);
		setIsCommunicationError(false);
	};

	const handleRetryFromError = () => {
		setShowErrorModal(false);
		setError(null);
		setErrorDetails(null);
		setIsCommunicationError(false);
		handleSummarize();
	};

	const handleReloadPage = () => {
		if (currentTabId && typeof chrome !== 'undefined' && chrome.tabs) {
			chrome.tabs.reload(currentTabId);
			setShowErrorModal(false);
			setError(null);
			setErrorDetails(null);
			setIsCommunicationError(false);
		}
	};

	// Helper function to re-inject content script and retry communication
	const reinjectAndRetry = async <T,>(
		action: string,
		payload?: Record<string, unknown>,
	): Promise<{ success: boolean; response?: T; error?: string }> => {
		if (!currentTabId || typeof chrome === 'undefined') {
			return { success: false, error: 'No tab ID or chrome API unavailable' };
		}

		// First try to reinject the content script
		try {
			const reinjectResult = await new Promise<{ success: boolean }>((resolve) => {
				chrome.runtime.sendMessage(
					{ action: 'REINJECT_CONTENT_SCRIPT', tabId: currentTabId },
					(response: any) => {
						if (chrome.runtime?.lastError) {
							resolve({ success: false });
							return;
						}
						resolve(response || { success: false });
					},
				);
			});

			if (!reinjectResult.success) {
				return { success: false, error: 'Failed to reinject content script' };
			}

			// Wait a bit for the content script to initialize
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Now try to send the message again
			const response = await new Promise<T>((resolve, reject) => {
				chrome.tabs.sendMessage(
					currentTabId,
					{ action, ...payload },
					(response: any) => {
						if (chrome.runtime?.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}
						resolve(response);
					},
				);
			});

			return { success: true, response };
		} catch (error: any) {
			return { success: false, error: error?.message || 'Unknown error' };
		}
	};

	const handleConnectGoogle = async () => {
		try {
			setKeySetupError(null);
			setKeySetupSuccess(null);

			if (window.aistudio) {
				const maybeResult = await window.aistudio.openSelectKey();
				const selectedKey =
					(typeof maybeResult === 'string' && maybeResult) ||
					(await window.aistudio.getSelectedApiKey?.()) ||
					window.aistudio.selectedApiKey ||
					null;

				if (selectedKey) {
					await persistApiKey(selectedKey);
					return;
				}

				const hasKey = await window.aistudio.hasSelectedApiKey();
				if (!hasKey) {
					setKeySetupError(t('auth.selectKeyPrompt'));
				}
				return;
			}

			window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener');
		} catch (e) {
			console.error('Selection failed', e);
			setKeySetupError(t('auth.connectError'));
		}
	};

	const handleSaveApiKey = async () => {
		setKeySetupError(null);
		setKeySetupSuccess(null);

		if (!apiKeyInput.trim()) {
			setKeySetupError(t('auth.errorMissing'));
			return;
		}

		try {
			setSavingKey(true);
			await persistApiKey(apiKeyInput);
			setApiKeyInput('');
		} catch (err) {
			console.error('Failed to save API key', err);
			setKeySetupError(t('auth.saveError'));
		} finally {
			setSavingKey(false);
		}
	};

	const handleDisconnectKey = async () => {
		try {
			await clearUserApiKey();
		} catch (err) {
			console.error('Failed to clear API key', err);
		} finally {
			setApiKey(null);
			setKeySetupSuccess(null);
			setKeySetupError(null);
			setStatus(AppState.IDLE);
			setResult(null);
			setError(null);
		}
	};

	const handleOfflineSummarize = async () => {
		setIsOfflineLoading(true);
		setOfflineStatus(t('offline.extractingTranscript'));

		try {
			let transcriptText = '';

			if (isYoutube && currentTabId && typeof chrome !== 'undefined') {
				try {
					const response = await chrome.tabs.sendMessage(currentTabId, { action: 'EXTRACT_TRANSCRIPT' });

					if (response && response.success) {
						transcriptText = response.transcript;
					} else {
						if (response?.errorCode === 'NO_TRANSCRIPT') {
							throw new Error(t('errors.captionsMissing'));
						}
						throw new Error(response?.error || t('errors.extractionFailed'));
					}
				} catch (msgError: any) {
					console.warn('Message passing failed, attempting to reinject content script:', msgError);

					const retryResult = await reinjectAndRetry<{
						success: boolean;
						transcript?: string;
						error?: string;
						errorCode?: string;
					}>('EXTRACT_TRANSCRIPT');

					if (retryResult.success && retryResult.response?.success) {
						transcriptText = retryResult.response.transcript || '';
					} else if (retryResult.response?.errorCode === 'NO_TRANSCRIPT') {
						throw new Error(t('errors.captionsMissing'));
					} else {
						throw new Error(t('errors.communication'));
					}
				}
			} else {
				transcriptText = getFullTranscriptText();
			}

			if (!transcriptText || transcriptText.length < 50) {
				throw new Error(t('errors.transcriptShort'));
			}

			setOfflineStatus(t('offline.preparingPrompt'));

			// Build the prompt
			const trimmedQuery = userQuery.trim();
			const prompt = buildOfflinePrompt(transcriptText, selectedLanguageOption, trimmedQuery);

			// Store the prompt for auto-injection
			await storePendingPrompt(prompt);

			// Copy to clipboard
			const copied = await copyToClipboard(prompt);

			if (!copied) {
				setOfflineStatus(t('offline.copyFailed'));
				setIsOfflineLoading(false);
				return;
			}

			setOfflineStatus(t('offline.openingDeepSeek'));

			// Small delay to show status
			await new Promise(resolve => setTimeout(resolve, 500));

			// Open DeepSeek
			openDeepSeekChat();

			// Show success message
			setOfflineStatus(t('offline.promptCopied'));

			// Clear status after a few seconds
			setTimeout(() => {
				setOfflineStatus(null);
				setIsOfflineLoading(false);
			}, 5000);

		} catch (err: any) {
			console.error('Offline summarize error:', err);
			setOfflineStatus(err.message || t('errors.extractionFailed'));
			setTimeout(() => {
				setOfflineStatus(null);
				setIsOfflineLoading(false);
			}, 3000);
		}
	};

	const handleSummarize = async () => {
		if (!apiKey) {
			handleLanguageAwareError(t('errors.apiKeyMissing'), 'API Key is not configured');
			return;
		}

		setStatus(AppState.LOADING);
		setError(null);
		setResult(null);
		setIsFromCache(false);
		setIsImproving(false);

		try {
			let transcriptText = '';

			if (isYoutube && currentTabId && typeof chrome !== 'undefined') {
				// Re-check captions availability in real-time before extraction
				// This handles YouTube SPA navigation where initial check may be stale
				try {
					const captionCheck = await new Promise<{ success: boolean; hasCaptions?: boolean }>((resolve) => {
						chrome.tabs.sendMessage(currentTabId, { action: 'CHECK_CAPTIONS' }, (response: any) => {
							if (chrome.runtime?.lastError) {
								resolve({ success: false });
								return;
							}
							resolve(response || { success: false });
						});
					});

					if (captionCheck.success) {
						setHasCaptions(Boolean(captionCheck.hasCaptions));
					}
				} catch {
					// Continue even if caption check fails - extraction might still work
				}

				try {
					const response = await chrome.tabs.sendMessage(currentTabId, { action: 'EXTRACT_TRANSCRIPT' });

					if (response && response.success) {
						transcriptText = response.transcript;
						setHasCaptions(true);
					} else {
						console.warn('Real extraction failed:', response?.error);
						if (response?.errorCode === 'NO_TRANSCRIPT') {
							setHasCaptions(false);
							throw new Error(t('errors.captionsMissing'));
						}
						throw new Error(response?.error || t('errors.extractionFailed'));
					}
				} catch (msgError: any) {
					console.warn('Message passing failed, attempting to reinject content script:', msgError);

					// Try to reinject the content script and retry
					const retryResult = await reinjectAndRetry<{
						success: boolean;
						transcript?: string;
						error?: string;
						errorCode?: string;
					}>('EXTRACT_TRANSCRIPT');

					if (retryResult.success && retryResult.response?.success) {
						transcriptText = retryResult.response.transcript || '';
						setHasCaptions(true);
						console.log('Successfully extracted transcript after reinjection');
					} else if (retryResult.response?.errorCode === 'NO_TRANSCRIPT') {
						setHasCaptions(false);
						throw new Error(t('errors.captionsMissing'));
					} else {
						// Re-injection failed or extraction still failed - throw communication error
						console.error('Re-injection or retry failed:', retryResult.error);
						const communicationError = new Error(t('errors.communication'));
						(communicationError as any).isCommunicationError = true;
						throw communicationError;
					}
				}
			} else {
				transcriptText = getFullTranscriptText();
			}

			if (!transcriptText || transcriptText.length < 50) {
				throw new Error(t('errors.transcriptShort'));
			}

			// Store transcript for improvement phase
			setCurrentTranscript(transcriptText);

			// Store transcript length for loading animation timing
			setTranscriptLength(transcriptText.length);

			const trimmedQuery = userQuery.trim();
			let initialResult: AnalysisResult;

			// Reset retry attempt counter
			setRetryAttempt(0);

			// Callback to track retry attempts for UI feedback
			const handleRetry = (attempt: number, error: Error) => {
				console.log(`Retry attempt ${attempt} due to:`, error.message);
				setRetryAttempt(attempt);
			};

			if (trimmedQuery) {
				// User has a question: make TWO separate API calls in parallel
				// Both wrapped with timeout and retry logic
				const [userAnswerResult, analysisResult] = await Promise.all([
					withTimeoutAndRetry(
						() => answerUserQuestion(transcriptText, trimmedQuery, apiKey, selectedLanguageOption),
						SUMMARY_TIMEOUT_MS,
						MAX_RETRY_ATTEMPTS,
						'User question analysis',
						handleRetry,
					),
					withTimeoutAndRetry(
						() => analyzeVideo(transcriptText, apiKey, selectedLanguageOption),
						SUMMARY_TIMEOUT_MS,
						MAX_RETRY_ATTEMPTS,
						'Video analysis',
						handleRetry,
					),
				]);

				// Combine results: user answer goes in customAnswer field
				initialResult = {
					customAnswer: userAnswerResult,
					summary: analysisResult.summary,
					keyMoments: analysisResult.keyMoments,
				};
			} else {
				// No question: just summarize with timeout and retry
				initialResult = await withTimeoutAndRetry(
					() => analyzeVideo(transcriptText, apiKey, selectedLanguageOption),
					SUMMARY_TIMEOUT_MS,
					MAX_RETRY_ATTEMPTS,
					'Video analysis',
					handleRetry,
				);
			}

			// Reset retry counter on success
			setRetryAttempt(0);

			// Show initial result immediately
			setResult(initialResult);
			setStatus(AppState.SUCCESS);

			// Start improvement phase in background
			setIsImproving(true);

			try {
				const improvedResult = await improveResult(
					initialResult,
					transcriptText,
					apiKey,
					selectedLanguageOption,
				);

				// Update with improved result
				setResult(improvedResult);

				// Save improved result to IndexedDB for persistence
				const videoId = extractVideoId(currentVideoUrl);
				if (videoId && currentVideoUrl) {
					saveSummary(videoId, improvedResult, currentVideoUrl, language, trimmedQuery).catch((err) => {
						console.warn('Failed to save summary to cache:', err);
					});
				}
			} catch (improvementError) {
				// If improvement fails, keep the initial result and save it
				console.warn('Improvement failed, keeping initial result:', improvementError);
				const videoId = extractVideoId(currentVideoUrl);
				if (videoId && currentVideoUrl) {
					saveSummary(videoId, initialResult, currentVideoUrl, language, trimmedQuery).catch((err) => {
						console.warn('Failed to save summary to cache:', err);
					});
				}
			} finally {
				setIsImproving(false);
			}
		} catch (err: any) {
			setIsImproving(false);
			setRetryAttempt(0);

			const errorStack = err.stack || '';
			const errorName = err.name || 'Error';

			// Check if it's a timeout error (indicates slow connection or API issues)
			const isTimeoutErr = err instanceof TimeoutError || err.name === 'TimeoutError';

			// Check if it's a network/connection error
			const isNetworkErr =
				err.message?.toLowerCase().includes('network') ||
				err.message?.toLowerCase().includes('fetch') ||
				err.message?.toLowerCase().includes('connection') ||
				err.name === 'TypeError';

			// Determine the appropriate error message
			let errorMessage: string;
			let isCommunicationErr = Boolean(err.isCommunicationError);

			if (isTimeoutErr) {
				errorMessage = t('errors.timeout');
				isCommunicationErr = true; // Show reload option for timeout
			} else if (isNetworkErr) {
				errorMessage = t('errors.networkError');
				isCommunicationErr = true; // Show reload option for network errors
			} else {
				errorMessage = err.message || t('errors.extractionFailed');
			}

			const formattedDetails = `${errorName}: ${err.message || 'Unknown error'}${errorStack ? `\n\nStack trace:\n${errorStack}` : ''}`;

			if (err.message && err.message.includes('Requested entity was not found')) {
				await clearUserApiKey();
				setApiKey(null);
				setKeySetupSuccess(null);
				handleLanguageAwareError(t('errors.apiKeyInvalid'), formattedDetails, false);
			} else {
				handleLanguageAwareError(errorMessage, formattedDetails, isCommunicationErr);
			}
		}
	};

	const captionText = checkingCaptions
		? t('captions.checking')
		: hasCaptions === true
		? t('captions.available')
		: hasCaptions === false
		? t('captions.unavailable')
		: t('captions.unknown');

	const captionBadgeClass =
		hasCaptions === true
			? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800'
			: hasCaptions === false
			? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800'
			: checkingCaptions
			? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800'
			: 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

	const captionDotClass =
		hasCaptions === true
			? 'bg-green-500'
			: hasCaptions === false
			? 'bg-red-500'
			: checkingCaptions
			? 'bg-amber-500'
			: 'bg-gray-400';

	const seekToVideoTime = useCallback(
		(rawTime: string) => {
			const seconds = parseTimestampToSeconds(rawTime);
			if (seconds === null) {
				console.warn('Unable to parse timestamp:', rawTime);
				return;
			}

			if (!isYoutube || !currentTabId || typeof chrome === 'undefined' || !chrome.tabs) {
				console.warn('Timestamp jumps are only available on active YouTube videos.');
				return;
			}

			chrome.tabs.sendMessage(currentTabId, { action: 'SEEK_TO', timeInSeconds: seconds }, (response: any) => {
				if (typeof chrome !== 'undefined' && chrome.runtime?.lastError) {
					console.warn('Seek request failed:', chrome.runtime.lastError.message);
					return;
				}
				if (!response?.success) {
					console.warn('Seek request failed:', response?.error);
				}
			});
		},
		[currentTabId, isYoutube],
	);

	if (checkingTab || checkingKey) {
		return (
			<div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
				<svg
					className="animate-spin h-6 w-6 text-brand-600"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		);
	}

	// LOGIN SCREEN
	if (!apiKey) {
		return (
			<div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
				<div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full max-w-sm">
					<div className="flex justify-end mb-4 gap-2">
						<ThemeSelector theme={theme} onThemeChange={setTheme} />
						<LanguagePicker id="language-selector-auth" />
					</div>
					<div className="flex justify-center mb-6">
						<Logo className="w-16 h-16" />
					</div>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('auth.welcomeTitle')}</h2>
					<p className="text-gray-500 dark:text-gray-400 text-sm mb-8">{t('auth.description')}</p>

					<div className="space-y-2">
						<button
							onClick={handleConnectGoogle}
							className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-all shadow-sm group"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
							<span>{t('auth.googleButton')}</span>
						</button>
						<p className="text-[11px] text-gray-400 dark:text-gray-500">{t('auth.googleHelper')}</p>
					</div>

					<div className="mt-6 text-left space-y-2">
						<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('auth.pasteLabel')}</label>
						<input
							type="password"
							value={apiKeyInput}
							onChange={(e) => setApiKeyInput(e.target.value)}
							placeholder={t('auth.placeholder') ?? ''}
							className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
						/>
						<button
							onClick={handleSaveApiKey}
							disabled={savingKey}
							className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
						>
							{savingKey ? t('auth.savingButton') : t('auth.saveButton')}
						</button>
					</div>

					{keySetupError && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{keySetupError}</p>}
					{keySetupSuccess && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{keySetupSuccess}</p>}

					{/* Offline Mode Section */}
					<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
						<div className="mb-3">
							<label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
								{t('input.label')} <span className="text-gray-400 dark:text-gray-500 font-normal">{t('input.optional')}</span>
							</label>
							<input
								type="text"
								value={userQuery}
								onChange={(e) => setUserQuery(e.target.value)}
								placeholder={t('input.placeholder') ?? ''}
								disabled={!isYoutube || isOfflineLoading}
								className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none disabled:opacity-50"
							/>
						</div>
						<button
							onClick={handleOfflineSummarize}
							disabled={!isYoutube || isOfflineLoading}
							className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-sm"
						>
							{isOfflineLoading ? (
								<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							) : (
								<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
							)}
							<span>{t('offline.useWithoutKey')}</span>
						</button>
						<p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 text-center">
							{t('offline.useWithoutKeyDescription')}
						</p>
						{offlineStatus && (
							<p className={`mt-2 text-sm text-center ${offlineStatus.includes('copied') || offlineStatus.includes('copiado') || offlineStatus.includes('copié') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
								{offlineStatus}
							</p>
						)}
						{!isYoutube && (
							<p className="mt-2 text-xs text-amber-600 dark:text-amber-400 text-center">
								{t('modal.noVideoDescription')}
							</p>
						)}
					</div>

					<p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500">
						{t('auth.billingNotice')}
						<a
							href="https://ai.google.dev/gemini-api/docs/billing"
							target="_blank"
							rel="noreferrer"
							className="underline hover:text-gray-600 dark:hover:text-gray-400 ml-1"
						>
							{t('auth.billingLink')}
						</a>
					</p>
					<p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
						{t('auth.helpNotice')}
						<a
							href="https://ai.google.dev/gemini-api/docs/api-key"
							target="_blank"
							rel="noreferrer"
							className="underline hover:text-gray-600 dark:hover:text-gray-400 ml-1"
						>
							{t('auth.helpLink')}
						</a>
					</p>
				</div>

				{/* Fixed Footer */}
				<footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-700 px-4 py-3 shadow-sm">
					<div className="flex items-center justify-center gap-4">
						{/* LinkedIn */}
						<a
							href="https://www.linkedin.com/in/frederico-kluser/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-[#0077B5] transition-colors"
							title="LinkedIn - Frederico Kluser"
						>
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
							</svg>
						</a>
						{/* GitHub */}
						<a
							href="https://github.com/frederico-kluser/tubegist"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
							title="GitHub - TubeGist"
						>
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								/>
							</svg>
						</a>
					</div>
				</footer>
			</div>
		);
	}

	const connectionBadgeClass = isYoutube
		? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800'
		: 'text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

	return (
		<div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col relative overflow-hidden">
			{/* Toast for improvement phase */}
			<Toast message={t('toast.improving')} isVisible={isImproving} />

			{!isYoutube && (
				<div className="absolute inset-0 z-50 bg-gray-900/40 dark:bg-gray-950/60 backdrop-blur-[2px] flex items-center justify-center p-6 animate-fade-in">
					<div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 text-center max-w-sm w-full transform transition-all scale-100">
						<div className="mx-auto w-14 h-14 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50 dark:ring-red-900/30">
							<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('modal.noVideoTitle')}</h3>
						<p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">{t('modal.noVideoDescription')}</p>
						<button
							onClick={() =>
								typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create({ url: 'https://www.youtube.com' })
							}
							className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
						>
							{t('modal.noVideoCta')}
						</button>
					</div>
				</div>
			)}

			{showSwitchKeyModal && (
				<div className="absolute inset-0 z-50 bg-gray-900/40 dark:bg-gray-950/60 backdrop-blur-[2px] flex items-center justify-center p-6 animate-fade-in">
					<div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 text-center max-w-sm w-full transform transition-all scale-100">
						<div className="mx-auto w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mb-4 ring-8 ring-amber-50/50 dark:ring-amber-900/30">
							<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('modal.switchKeyTitle')}</h3>
						<p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">{t('modal.switchKeyDescription')}</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowSwitchKeyModal(false)}
								className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors text-sm"
							>
								{t('modal.switchKeyCancel')}
							</button>
							<button
								onClick={() => {
									setShowSwitchKeyModal(false);
									handleDisconnectKey();
								}}
								className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
							>
								{t('modal.switchKeyConfirm')}
							</button>
						</div>
					</div>
				</div>
			)}

			<ErrorModal
				isOpen={showErrorModal}
				errorMessage={error || ''}
				errorDetails={errorDetails || undefined}
				onClose={handleCloseErrorModal}
				onRetry={handleRetryFromError}
				onReload={isCommunicationError ? handleReloadPage : undefined}
			/>

			{/* Audio API Key Required Modal */}
			{showAudioApiKeyModal && (
				<div className="absolute inset-0 z-50 bg-gray-900/40 dark:bg-gray-950/60 backdrop-blur-[2px] flex items-center justify-center p-6 animate-fade-in">
					<div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 text-center max-w-sm w-full transform transition-all scale-100">
						<div className="mx-auto w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mb-4 ring-8 ring-amber-50/50 dark:ring-amber-900/30">
							<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('audio.noApiKeyTitle')}</h3>
						<p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">{t('audio.noApiKeyDescription')}</p>
						<button
							onClick={() => setShowAudioApiKeyModal(false)}
							className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
						>
							{t('errorModal.close')}
						</button>
					</div>
				</div>
			)}

			<header
				className={`sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 shadow-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between transition-opacity ${
					!isYoutube ? 'opacity-50 pointer-events-none' : ''
				}`}
			>
				<div className="flex items-center gap-2">
					<Logo className="w-7 h-7" />
					<h1 className="font-bold text-lg text-gray-900 dark:text-gray-100 tracking-tight">Resumir</h1>
					<button
						onClick={() => window.close()}
						className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
						title={t('sidebar.close') ?? 'Close sidebar'}
						aria-label={t('sidebar.close') ?? 'Close sidebar'}
					>
						<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div className="grid grid-cols-2 gap-2">
					{/* Row 1 */}
					<div
						className={`text-xs px-2 py-1 rounded-full font-medium border flex items-center gap-1 justify-center ${connectionBadgeClass}`}
					>
						<span className={`w-2 h-2 rounded-full ${isYoutube ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
						{isYoutube ? t('status.connected') : t('status.disconnected')}
					</div>
					<div
						className={`text-xs px-2 py-1 rounded-full font-medium border flex items-center gap-1 justify-center ${captionBadgeClass}`}
					>
						<span className={`w-2 h-2 rounded-full ${captionDotClass}`}></span>
						<span className="whitespace-nowrap">{captionText}</span>
					</div>
					{/* Row 2 */}
					<ThemeSelector theme={theme} onThemeChange={setTheme} />
					<LanguagePicker id="language-selector-header" className="w-full text-center" />
					{apiKey ? (
						<button
							onClick={() => setShowSwitchKeyModal(true)}
							className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 rounded-lg font-medium transition-colors border border-gray-200 dark:border-gray-600"
						>
							{t('auth.switchKey')}
						</button>
					) : (
						<div></div>
					)}
				</div>
			</header>

			<main
				className={`flex-1 p-4 flex flex-col gap-4 max-w-sm mx-auto w-full transition-all duration-300 overflow-y-auto ${
					!isYoutube ? 'opacity-30 pointer-events-none blur-[1px]' : ''
				}`}
			>
				<div className="space-y-3">
					<label htmlFor="custom-query" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
						{t('input.label')} <span className="text-gray-400 dark:text-gray-500 font-normal">{t('input.optional')}</span>
					</label>
					<textarea
						id="custom-query"
						ref={inputRef}
						disabled={!isYoutube || status === AppState.LOADING}
						value={userQuery}
						onChange={(e) => setUserQuery(e.target.value)}
						placeholder={t('input.placeholder') ?? ''}
						className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-shadow resize-none shadow-sm disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500"
						rows={2}
					/>

					<Button onClick={handleSummarize} isLoading={status === AppState.LOADING} disabled={!isYoutube}>
						{userQuery.trim() ? t('input.buttonQuery') : t('input.buttonDefault')}
					</Button>

					<LoadingStatus isActive={status === AppState.LOADING} transcriptLength={transcriptLength} />
				</div>

				{status === AppState.SUCCESS && result && (
					<div className="flex flex-col gap-4 animate-fade-in pb-8">
						{isImproving && (
							<div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800">
								<svg
									className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-spin flex-shrink-0"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								<span className="text-sm text-amber-700 dark:text-amber-300 font-medium">{t('result.preliminary')}</span>
							</div>
						)}
						{isFromCache && !isImproving && (
							<div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800">
								<div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm">
									<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
										/>
									</svg>
									<span className="font-medium">{t('result.fromCache')}</span>
								</div>
								<button
									onClick={handleSummarize}
									className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 underline font-medium"
								>
									{t('result.regenerate')}
								</button>
							</div>
						)}

						{result.customAnswer && (
							<Card
								className="border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/20"
								title={t('result.answerTitle')}
								icon={
									<svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
										/>
									</svg>
								}
								headerAction={
									<AudioPlayButton
										text={result.customAnswer.text}
										apiKey={apiKey}
										onNoApiKey={() => setShowAudioApiKeyModal(true)}
									/>
								}
							>
								<p className="text-gray-900 dark:text-gray-100 font-medium mb-3">{result.customAnswer.text}</p>
								{result.customAnswer.relatedSegments && result.customAnswer.relatedSegments.length > 0 && (
									<div className="flex flex-wrap gap-2">
										{result.customAnswer.relatedSegments.map((seg, idx) => (
											<TimestampBadge key={idx} time={seg} onSelect={seekToVideoTime} />
										))}
									</div>
								)}
							</Card>
						)}

						<Card
							title={t('result.summaryTitle')}
							icon={
								<svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
								</svg>
							}
							headerAction={
								<AudioPlayButton
									text={result.summary}
									apiKey={apiKey}
									onNoApiKey={() => setShowAudioApiKeyModal(true)}
								/>
							}
						>
							{result.summary}
						</Card>

						<Card
							title={t('result.keyMomentsTitle')}
							icon={
								<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							}
						>
							<ul className="space-y-3 max-h-48 overflow-y-auto pr-1">
								{result.keyMoments.map((moment, idx) => (
									<li key={idx} className="flex gap-3 items-start group">
										<div className="mt-0.5 flex-shrink-0">
											<TimestampBadge time={moment.timestamp} onSelect={seekToVideoTime} />
										</div>
										<span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
											{moment.description}
										</span>
									</li>
								))}
							</ul>
						</Card>
					</div>
				)}
			</main>

			{/* Fixed Footer */}
			<footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-700 px-4 py-3 shadow-sm">
				<div className="flex items-center justify-between max-w-sm mx-auto">
					<span className="text-xs text-gray-400 dark:text-gray-500">
						{t('footer.powered', {
							mode: typeof chrome !== 'undefined' && chrome.tabs ? t('footer.extensionMode') : t('footer.mockMode'),
						})}
					</span>
					<div className="flex items-center gap-3">
						{/* LinkedIn */}
						<a
							href="https://www.linkedin.com/in/frederico-kluser/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-[#0077B5] transition-colors"
							title="LinkedIn - Frederico Kluser"
						>
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
							</svg>
						</a>
						{/* GitHub */}
						<a
							href="https://github.com/frederico-kluser/tubegist"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
							title="GitHub - TubeGist"
						>
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								/>
							</svg>
						</a>
					</div>
				</div>
			</footer>
			{/* Spacer to prevent content from being hidden behind fixed footer */}
			<div className="h-14"></div>
		</div>
	);
}
