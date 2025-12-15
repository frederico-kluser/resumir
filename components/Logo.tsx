import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
	<img src="/assets/logo-128.png" alt="Resumir Logo" className={className} />
);
