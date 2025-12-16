import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateSpeech, revokeAudioUrl, AudioState } from '../services/textToSpeechService';

interface AudioPlayButtonProps {
	text: string;
	apiKey: string | null;
	onNoApiKey: () => void;
}

export const AudioPlayButton: React.FC<AudioPlayButtonProps> = ({ text, apiKey, onNoApiKey }) => {
	const { t } = useTranslation();
	const [audioState, setAudioState] = useState<AudioState>('idle');
	const [error, setError] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const audioUrlRef = useRef<string | null>(null);

	// Cleanup audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
			if (audioUrlRef.current) {
				revokeAudioUrl(audioUrlRef.current);
				audioUrlRef.current = null;
			}
		};
	}, []);

	const handlePlay = useCallback(async () => {
		// Check if API key exists
		if (!apiKey) {
			onNoApiKey();
			return;
		}

		setError(null);

		// If already playing, stop and reset
		if (audioState === 'playing') {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0;
			}
			setAudioState('idle');
			return;
		}

		// Start loading
		setAudioState('loading');

		try {
			// Clean up previous audio URL if exists
			if (audioUrlRef.current) {
				revokeAudioUrl(audioUrlRef.current);
				audioUrlRef.current = null;
			}

			// Generate new audio
			const result = await generateSpeech(text, apiKey);
			audioUrlRef.current = result.audioUrl;

			// Create audio element
			const audio = new Audio(result.audioUrl);
			audioRef.current = audio;

			// Handle audio end
			audio.addEventListener('ended', () => {
				setAudioState('idle');
			});

			// Handle errors
			audio.addEventListener('error', () => {
				setError(t('audio.playbackError'));
				setAudioState('idle');
			});

			// Play
			await audio.play();
			setAudioState('playing');
		} catch (err: any) {
			console.error('TTS Error:', err);
			setError(err.message || t('audio.generationError'));
			setAudioState('idle');
		}
	}, [apiKey, audioState, onNoApiKey, text, t]);

	const getIcon = () => {
		if (audioState === 'loading') {
			// Loading spinner
			return (
				<svg
					className="animate-spin h-4 w-4"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			);
		}

		if (audioState === 'playing') {
			// Stop icon (square)
			return (
				<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" rx="1" />
				</svg>
			);
		}

		// Play icon
		return (
			<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M8 5v14l11-7z" />
			</svg>
		);
	};

	const getTitle = () => {
		if (audioState === 'loading') return t('audio.loading');
		if (audioState === 'playing') return t('audio.stop');
		return t('audio.play');
	};

	const buttonClass =
		audioState === 'playing'
			? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30'
			: audioState === 'loading'
			? 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 cursor-wait'
			: 'text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30';

	return (
		<div className="relative inline-flex items-center">
			<button
				type="button"
				onClick={handlePlay}
				disabled={audioState === 'loading'}
				title={getTitle()}
				className={`p-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${buttonClass}`}
			>
				{getIcon()}
			</button>
			{error && (
				<span className="absolute left-full ml-2 text-xs text-red-500 dark:text-red-400 whitespace-nowrap">
					{error}
				</span>
			)}
		</div>
	);
};
