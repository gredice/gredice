'use client';

import { useCurrentUser } from '../hooks/useCurrentUser';
import { isWinterSeason, useWinterMode } from './providers/WinterModeProvider';

export function WinterModeToggle() {
    const { isWinter, toggle } = useWinterMode();
    const { data: user, isLoading } = useCurrentUser();

    // Only show in demo mode (not logged in)
    if (isLoading || user) {
        return null;
    }

    // Only render during winter season (Dec 1 - Mar 20)
    if (!isWinterSeason()) {
        return null;
    }

    // Don't render until we've loaded the initial state
    if (isWinter === null) {
        return (
            <button
                type="button"
                disabled
                className="relative inline-flex h-7 w-14 items-center rounded-full bg-gray-200 cursor-not-allowed opacity-50 animate-scale-in"
                role="switch"
                aria-checked={false}
            >
                <span className="size-6 transform rounded-full bg-white shadow-lg transition-transform flex items-center justify-center text-sm translate-x-0.5">
                    ❄️
                </span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggle}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-1 focus:outline-primary focus:outline-offset-2 animate-scale-in ${
                isWinter
                    ? 'bg-blue-200 dark:bg-blue-400'
                    : 'bg-amber-200 dark:bg-amber-400'
            }`}
            role="switch"
            aria-checked={isWinter}
            title={
                isWinter ? 'Prebaci na ljetni način' : 'Prebaci na zimski način'
            }
        >
            <span
                className={`size-6 transform rounded-full bg-white shadow-lg transition-transform flex items-center justify-center text-sm ${
                    isWinter ? 'translate-x-7' : 'translate-x-0.5'
                }`}
            >
                {isWinter ? '❄️' : '☀️'}
            </span>
        </button>
    );
}
