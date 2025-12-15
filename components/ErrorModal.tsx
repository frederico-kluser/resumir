import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ErrorModalProps {
	isOpen: boolean;
	errorMessage: string;
	errorDetails?: string;
	onClose: () => void;
	onRetry?: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, errorMessage, errorDetails, onClose, onRetry }) => {
	const { t } = useTranslation();

	if (!isOpen) return null;

	return (
		<div className="absolute inset-0 z-50 bg-gray-900/40 backdrop-blur-[2px] flex items-center justify-center p-6 animate-fade-in">
			<div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-6 text-center max-w-sm w-full transform transition-all scale-100">
				<div className="mx-auto w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50">
					<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<h3 className="text-lg font-bold text-gray-900 mb-2">{t('errorModal.title')}</h3>
				<p className="text-gray-600 text-sm mb-4 leading-relaxed">{errorMessage}</p>

				{errorDetails && (
					<div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-left">
						<p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t('errorModal.details')}</p>
						<pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto">
							{errorDetails}
						</pre>
					</div>
				)}

				<div className="flex gap-3">
					<button
						onClick={onClose}
						className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
					>
						{t('errorModal.close')}
					</button>
					{onRetry && (
						<button
							onClick={onRetry}
							className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
						>
							{t('errorModal.retry')}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
