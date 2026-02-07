'use client';

import { GameScene } from '@gredice/game';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { useEffect, useState } from 'react';
import {
    isChristmasHolidaySeason,
    useWinterMode,
} from '../components/providers/WinterModeProvider';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { KnownPages } from '../src/KnownPages';

// Summer weather - warm and sunny
const summerWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    windDirection: 0,
    windSpeed: 0,
    snowAccumulation: 0,
};

// Winter weather - snowy
const winterWeather = {
    cloudy: 0.2,
    foggy: 0,
    rainy: 0,
    snowy: 0.3,
    windDirection: 0,
    windSpeed: 0.3,
    snowAccumulation: 8,
};

export function LandingGameScene() {
    const { isWinter } = useWinterMode();
    const winterMode = isWinter
        ? isChristmasHolidaySeason()
            ? 'holiday'
            : 'winter'
        : 'summer';
    const [isMobile, setIsMobile] = useState(false);
    const { data: user, isLoading } = useCurrentUser();

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) =>
            setIsMobile(event.matches);

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    if (isLoading) {
        return null;
    }

    const isLoggedIn = Boolean(user);

    return (
        <>
            <GameScene
                appBaseUrl="https://vrt.gredice.com"
                zoom={isMobile ? 'far' : 'normal'}
                hideHud
                noControls
                noSound
                mockGarden={!isLoggedIn}
                winterMode={winterMode}
                weather={
                    isLoggedIn
                        ? undefined
                        : isWinter
                          ? winterWeather
                          : summerWeather
                }
            />
            {isLoggedIn && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                    <NavigatingButton
                        href={KnownPages.GardenApp}
                        variant="solid"
                        className="rounded-full shadow-lg"
                    >
                        Otvori moj vrt
                    </NavigatingButton>
                </div>
            )}
        </>
    );
}
