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

export function LandingGameScene() {
    const { isWinter } = useWinterMode();
    const winterMode = isWinter
        ? isChristmasHolidaySeason()
            ? 'holiday'
            : 'winter'
        : 'summer';
    const [isMobile, setIsMobile] = useState(false);

    const { data: user } = useCurrentUser();
    const isLoggedIn = Boolean(user);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) =>
            setIsMobile(event.matches);

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

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

    // Use winter date for winter mode, summer date for summer mode
    const freezeTime = isWinter
        ? new Date(2025, 11, 21, 11, 30) // December 21st (winter)
        : new Date(2025, 5, 21, 11, 30); // June 21st (summer)

    return (
        <>
            <GameScene
                appBaseUrl="https://vrt.gredice.com"
                freezeTime={isLoggedIn ? undefined : freezeTime}
                zoom={isMobile ? 'far' : 'normal'}
                noBackground
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
                        className="bg-green-800 hover:bg-green-700 rounded-full shadow-lg"
                    >
                        Otvori moj vrt 🌱
                    </NavigatingButton>
                </div>
            )}
        </>
    );
}
