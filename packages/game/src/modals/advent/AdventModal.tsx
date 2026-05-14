'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { useCallback, useEffect, useState } from 'react';
import { useAdventCalendar } from '../../hooks/useAdventCalendar';
import { useOpenAdventDay } from '../../hooks/useOpenAdventDay';
import { AdventAlreadyOpenedScreen } from './AdventAlreadyOpenedScreen';
import { AdventAwardScreen } from './AdventAwardScreen';
import { AdventCalendarScreen } from './AdventCalendarScreen';
import { AdventDescriptionScreen } from './AdventDescriptionScreen';
import { AdventMissedDayScreen } from './AdventMissedDayScreen';
import { AdventWelcomeScreen } from './AdventWelcomeScreen';

type AdventAward = {
    kind: 'sunflowers' | 'plant' | 'decoration' | 'tree-decoration' | 'gift';
    amount?: number;
    plantSortId?: number;
    blockId?: string;
    day?: number;
    title?: string;
    gift?: string;
    delivery?: string;
};

type AdventAwardDescription = {
    title: string;
    description: string;
};

type Screen =
    | 'welcome'
    | 'description'
    | 'calendar'
    | 'award'
    | 'missed'
    | 'alreadyOpened';

export function AdventModal() {
    const [adventParam, setAdventParam] = useSearchParam('advent');
    const isOpen = adventParam === 'open';

    const { data: calendarData, isLoading } = useAdventCalendar();
    const openDay = useOpenAdventDay();

    const [screen, setScreen] = useState<Screen>('welcome');
    const [awards, setAwards] = useState<AdventAward[]>([]);
    const [awardDescriptions, setAwardDescriptions] = useState<
        AdventAwardDescription[]
    >([]);
    const [currentAwardIndex, setCurrentAwardIndex] = useState(0);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [openedDayAwards, setOpenedDayAwards] = useState<AdventAward[]>([]);

    // Determine the current day of December (1-24)
    const getCurrentAdventDay = () => {
        const now = new Date();
        const month = now.getMonth(); // 0-indexed, December = 11
        const day = now.getDate();

        // Only December 1-24
        if (month === 11 && day >= 1 && day <= 24) {
            return day;
        }
        // Before December, return 0
        if (month < 11) {
            return 0;
        }
        // After December 24, return 24
        return 24;
    };

    const currentDay = getCurrentAdventDay();

    // Check if user has opened at least one day
    const hasOpenedAnyDay = calendarData?.openedCount
        ? calendarData.openedCount > 0
        : false;

    // Reset screen when modal opens
    // Use a ref to track if this is the initial open
    const [initialScreen, setInitialScreen] = useState<Screen | null>(null);

    useEffect(() => {
        if (isOpen && initialScreen === null) {
            // Only set initial screen on first open
            const startScreen = hasOpenedAnyDay ? 'calendar' : 'welcome';
            setInitialScreen(startScreen);
            setScreen(startScreen);
            setAwards([]);
            setAwardDescriptions([]);
            setCurrentAwardIndex(0);
        } else if (!isOpen) {
            // Reset when modal closes
            setInitialScreen(null);
        }
    }, [isOpen, hasOpenedAnyDay, initialScreen]);

    const handleClose = useCallback(() => {
        setAdventParam(undefined);
    }, [setAdventParam]);

    const handleDayClick = async (
        day: number,
        type: 'canOpen' | 'opened' | 'missed' | 'future',
    ) => {
        setSelectedDay(day);

        if (type === 'missed') {
            setScreen('missed');
            return;
        }

        if (type === 'opened') {
            // Pull awards from the calendar data for the opened day
            const dayData = calendarData?.days?.find((d) => d.day === day);
            setOpenedDayAwards(dayData?.awards ?? []);
            setScreen('alreadyOpened');
            return;
        }

        if (type === 'future') {
            // Future days - wobble animation is handled in the cell component
            return;
        }

        // canOpen - proceed with opening the day
        try {
            const result = (await openDay.mutateAsync(day)) as {
                message: string;
                awards?: AdventAward[];
                awardDescriptions?: AdventAwardDescription[];
            };
            console.log('Advent day open result:', result);
            if (
                result.awards &&
                result.awardDescriptions &&
                result.awards.length > 0
            ) {
                setAwards(result.awards);
                setAwardDescriptions(result.awardDescriptions);
                setCurrentAwardIndex(0);
                setScreen('award');
            }
        } catch (error) {
            console.error('Failed to open advent day:', error);
        }
    };

    const handleAwardContinue = () => {
        if (currentAwardIndex < awards.length - 1) {
            setCurrentAwardIndex((prev) => prev + 1);
        } else {
            // No more awards, return to calendar
            setScreen('calendar');
            setAwards([]);
            setAwardDescriptions([]);
            setCurrentAwardIndex(0);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Spinner loadingLabel="Učitavanje..." />
                </div>
            );
        }

        switch (screen) {
            case 'welcome':
                return (
                    <AdventWelcomeScreen
                        onContinue={() => setScreen('description')}
                    />
                );
            case 'description':
                return (
                    <AdventDescriptionScreen
                        onContinue={() => setScreen('calendar')}
                    />
                );
            case 'calendar': {
                // Check if today's day has been opened
                const todayOpened =
                    calendarData?.days?.find((d) => d.day === currentDay)
                        ?.opened ?? false;
                return (
                    <AdventCalendarScreen
                        days={calendarData?.days ?? []}
                        currentDay={currentDay}
                        onDayClick={handleDayClick}
                        isLoading={openDay.isPending}
                        todayOpened={todayOpened}
                    />
                );
            }
            case 'award':
                return (
                    <AdventAwardScreen
                        award={awards[currentAwardIndex]}
                        description={awardDescriptions[currentAwardIndex]}
                        onContinue={handleAwardContinue}
                    />
                );
            case 'missed':
                return (
                    <AdventMissedDayScreen
                        day={selectedDay ?? 0}
                        onClose={() => setScreen('calendar')}
                    />
                );
            case 'alreadyOpened':
                return (
                    <AdventAlreadyOpenedScreen
                        day={selectedDay ?? 0}
                        awards={openedDayAwards}
                        onClose={() => setScreen('calendar')}
                    />
                );
        }
    };

    return (
        <Modal
            title="Adventski kalendar"
            open={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            className="md:max-w-sm border-tertiary border-b-4 p-0 overflow-hidden"
        >
            <div className="bg-background">{renderContent()}</div>
        </Modal>
    );
}
