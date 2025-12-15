import React from 'react';
import { useTranslation } from 'react-i18next';
import { Theme } from '../hooks/useTheme';

interface ThemeSelectorProps {
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
	className?: string;
}

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
		/>
	</svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
		/>
	</svg>
);

const SystemIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
		/>
	</svg>
);

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ theme, onThemeChange, className = '' }) => {
	const { t } = useTranslation();

	const themes: { value: Theme; icon: React.FC<{ className?: string }>; labelKey: string }[] = [
		{ value: 'light', icon: SunIcon, labelKey: 'theme.light' },
		{ value: 'dark', icon: MoonIcon, labelKey: 'theme.dark' },
		{ value: 'system', icon: SystemIcon, labelKey: 'theme.system' },
	];

	return (
		<div className={`flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
			{themes.map(({ value, icon: Icon, labelKey }) => (
				<button
					key={value}
					type="button"
					onClick={() => onThemeChange(value)}
					className={`
						p-1.5 rounded-md transition-all
						${
							theme === value
								? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
								: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
						}
					`}
					title={t(labelKey) ?? value}
					aria-label={t(labelKey) ?? value}
				>
					<Icon className="w-4 h-4" />
				</button>
			))}
		</div>
	);
};

export default ThemeSelector;
