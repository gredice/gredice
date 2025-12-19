'use client';

import { GameScene } from '@gredice/game';
import { useWinterMode } from '../components/providers/WinterModeProvider';

export function LandingGameScene() {
    const { isWinter } = useWinterMode();

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
        <GameScene
            appBaseUrl="https://vrt.gredice.com"
            freezeTime={freezeTime}
            zoom="far"
            noBackground
            hideHud
            noControls
            noSound
            mockGarden
            isWinterMode={isWinter ?? false}
            weather={isWinter ? winterWeather : summerWeather}
        />
    );
}
