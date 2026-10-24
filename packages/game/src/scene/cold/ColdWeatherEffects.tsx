import { useEffect } from 'react';
import { useGameState } from '../../useGameState';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import type { GameQualityProfileTier } from '../gameQuality';
import { ColdBreath } from './ColdBreath';
import { type ColdWeatherInput, resolveColdWeather } from './coldWeather';

export function ColdWeatherEffects({
    weather,
    tier,
    enabled,
}: {
    weather: ColdWeatherInput | undefined;
    tier: GameQualityProfileTier;
    enabled: boolean;
}) {
    const setFrostIntensity = useGameState((state) => state.setFrostIntensity);
    const { frost, breath } = resolveColdWeather(weather, tier, enabled);
    useEffect(() => {
        setFrostIntensity(frost);
        updateGameProfileMetadata({ frostIntensity: frost });
        return () => {
            setFrostIntensity(0);
            updateGameProfileMetadata({ frostIntensity: 0 });
        };
    }, [frost, setFrostIntensity]);
    return breath > 0 ? <ColdBreath strength={breath} tier={tier} /> : null;
}
