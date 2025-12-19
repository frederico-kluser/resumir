import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'resumir.theme';

const getSystemTheme = (): 'light' | 'dark' => {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
	const root = document.documentElement;
	const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

	if (effectiveTheme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
};

export const useTheme = () => {
	const [theme, setThemeState] = useState<Theme>('system');

	// Initialize theme from storage or system preference
	useEffect(() => {
		let stored: string | null = null;
		if (typeof window !== 'undefined') {
			try {
				stored = window.localStorage.getItem(THEME_STORAGE_KEY);
			} catch (e) {
				console.warn('Failed to read stored theme', e);
			}
		}

		const initialTheme: Theme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
		setThemeState(initialTheme);
		applyTheme(initialTheme);
	}, []);

	// Listen for system theme changes when using 'system' mode
	useEffect(() => {
		if (theme !== 'system' || typeof window === 'undefined') return;

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => applyTheme('system');

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, [theme]);

	const setTheme = useCallback((newTheme: Theme) => {
		setThemeState(newTheme);
		applyTheme(newTheme);

		if (typeof window !== 'undefined') {
			try {
				window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
			} catch (e) {
				console.warn('Failed to persist theme', e);
			}
		}
	}, []);

	const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

	return {
		theme,
		effectiveTheme,
		setTheme,
		isDark: effectiveTheme === 'dark',
	};
};

export default useTheme;
