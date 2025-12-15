import React from 'react';
import { useTranslation } from 'react-i18next';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, isLoading, className = '', ...props }) => {
  const { t } = useTranslation();

  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={`
        w-full flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-white transition-all
        bg-brand-600 hover:bg-brand-500 active:bg-brand-900 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {t('button.analyzing')}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; title?: string; icon?: React.ReactNode; className?: string }> = ({
  children,
  title,
  icon,
  className = ""
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 ${className}`}>
    {title && (
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
    )}
    <div className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
      {children}
    </div>
  </div>
);

interface TimestampBadgeProps {
  time: string;
  onSelect?: (time: string) => void;
}

export const TimestampBadge: React.FC<TimestampBadgeProps> = ({ time, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect?.(time)}
    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-800 cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-700"
  >
    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    {time}
  </button>
);