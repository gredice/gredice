import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import { Vector2 } from 'three';
import { resolveAutumnPropWindStrength } from './autumnPropWind';
import type { GameQualityProfileTier } from './gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from './SceneTime';

const calmWeather = { speed: 0, direction: 0, snow: 0, enabled: false };
const query = '(prefers-reduced-motion: reduce)';
function subscribeMotion(listener: () => void) {
    const media = window.matchMedia(query);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
}
const getReducedMotion = () => window.matchMedia(query).matches;

const AutumnPropWindContext = createContext<{
    time: ReturnType<typeof useSceneTimeUniform>;
    strength: { value: number };
    direction: { value: Vector2 };
    register: () => () => void;
    setWeather: (weather: typeof calmWeather) => void;
} | null>(null);

export function AutumnPropWindProvider({
    children,
    tier,
}: PropsWithChildren<{ tier: GameQualityProfileTier }>) {
    const time = useSceneTimeUniform();
    const fixedTime = useSceneFixedTimeSeconds();
    const visible = useSceneRuntimeVisible();
    const requestRender = useSceneRenderRequest();
    const reducedMotion = useSyncExternalStore(
        subscribeMotion,
        getReducedMotion,
        () => false,
    );
    const [weather, setWeather] = useState(calmWeather);
    const [consumers, setConsumers] = useState(0);
    const register = useCallback(() => {
        setConsumers((count) => count + 1);
        return () => setConsumers((count) => count - 1);
    }, []);
    const value = useMemo(
        () => ({
            time,
            strength: { value: 0 },
            direction: { value: new Vector2(0, -1) },
            register,
            setWeather,
        }),
        [time, register],
    );
    const strength = resolveAutumnPropWindStrength({
        ...weather,
        tier,
        reducedMotion,
        enabled: weather.enabled && visible,
    });
    useLayoutEffect(() => {
        value.strength.value = strength;
        const angle =
            ((Number.isFinite(weather.direction) ? weather.direction : 0) *
                Math.PI) /
            180;
        value.direction.value.set(Math.sin(angle), -Math.cos(angle));
        requestRender('autumn-prop-wind-change');
    }, [strength, value, weather.direction, requestRender]);
    // One scene owner, no per-prop frame callbacks, timers or React frame state.
    useSceneTimeInvalidation(
        'autumn-prop-wind',
        consumers > 0 && strength > 0 && fixedTime === undefined,
    );
    return (
        <AutumnPropWindContext.Provider value={value}>
            {children}
        </AutumnPropWindContext.Provider>
    );
}

export function useAutumnPropWind() {
    return useContext(AutumnPropWindContext);
}
