'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useCallback, useEffect, useState } from 'react';
import { useAdventCalendar } from '../hooks/useAdventCalendar';
import { SantaCapIcon } from '../icons/SantaCap';
import { HudCard } from './components/HudCard';
import { HudMessageBubble } from './components/HudMessageBubble';

const ADVENT_MESSAGE_DISMISSED_KEY = 'advent-message-dismissed-day';

function useAdventMessageDismissed(currentDay: number | null) {
    const [isDismissed, setIsDismissed] = useState(true); // Default to dismissed to prevent flash

    useEffect(() => {
        if (typeof window === 'undefined' || currentDay === null) return;
        const dismissedDay = localStorage.getItem(ADVENT_MESSAGE_DISMISSED_KEY);
        setIsDismissed(dismissedDay === String(currentDay));
    }, [currentDay]);

    const dismiss = useCallback(() => {
        if (typeof window === 'undefined' || currentDay === null) return;
        localStorage.setItem(ADVENT_MESSAGE_DISMISSED_KEY, String(currentDay));
        setIsDismissed(true);
    }, [currentDay]);

    return { isDismissed, dismiss };
}

export function AdventHud() {
    const [, setAdventParam] = useSearchParam('advent');

    // Check if current date is in December
    const now = new Date();
    const isDecember = now.getMonth() === 11;
    const isAdventPeriod = isDecember;
    const currentDay = now.getDate();

    // Determine if there's a day to open (today's day exists and is not opened yet)
    const { data: calendar } = useAdventCalendar(isAdventPeriod);
    const todayStatus = calendar?.days?.find((d) => d.day === currentDay);
    const hasDayToOpen = todayStatus && !todayStatus.opened;

    const { isDismissed, dismiss } = useAdventMessageDismissed(
        hasDayToOpen ? currentDay : null,
    );

    // Only show advent period
    if (!isAdventPeriod) {
        return null;
    }

    const handleMessageClick = () => {
        dismiss();
        setAdventParam('open');
    };

    return (
        <HudCard open position="floating" className="static p-0.5">
            <div className="relative flex items-center gap-2">
                {/* Message bubble */}
                {hasDayToOpen && !isDismissed && (
                    <HudMessageBubble
                        position="right"
                        variant="green"
                        onClick={handleMessageClick}
                    >
                        Novi dan je stigao! 🎄
                    </HudMessageBubble>
                )}
                <div className="relative">
                    {/* Pulsating ring when there's a day to open */}
                    {hasDayToOpen && (
                        <div className="absolute -inset-1 rounded-full border-2 border-green-400 animate-ping pointer-events-none" />
                    )}
                    <IconButton
                        variant="plain"
                        className={cx(
                            'rounded-full size-10',
                            hasDayToOpen &&
                                'border-[1.5px] border-green-400 !bg-green-500 dark:!bg-green-800 hover:!bg-green-400 dark:hover:!bg-green-600',
                        )}
                        title="Adventski kalendar"
                        onClick={() => setAdventParam('open')}
                    >
                        <SantaCapIcon className="size-6 shrink-0" />
                    </IconButton>
                </div>
            </div>
        </HudCard>
    );
}
