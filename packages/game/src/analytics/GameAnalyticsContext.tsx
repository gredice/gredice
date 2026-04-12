'use client';

import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
} from 'react';

export type GameAnalyticsProperties = Record<
    string,
    boolean | null | number | string | undefined
>;

type GameAnalyticsCapture = (
    eventName: string,
    properties?: GameAnalyticsProperties,
) => void;

const noopCapture: GameAnalyticsCapture = () => undefined;

const GameAnalyticsContext = createContext<GameAnalyticsCapture>(noopCapture);

function sanitizeProperties(properties?: GameAnalyticsProperties) {
    if (!properties) {
        return undefined;
    }

    const entries = Object.entries(properties).filter(
        ([, value]) => value !== undefined,
    );

    if (!entries.length) {
        return undefined;
    }

    return Object.fromEntries(entries) as GameAnalyticsProperties;
}

export function GameAnalyticsProvider({
    capture,
    children,
}: PropsWithChildren<{ capture: GameAnalyticsCapture }>) {
    return (
        <GameAnalyticsContext.Provider value={capture}>
            {children}
        </GameAnalyticsContext.Provider>
    );
}

export function useGameAnalytics() {
    const capture = useContext(GameAnalyticsContext);

    const track = useCallback(
        (eventName: string, properties?: GameAnalyticsProperties) => {
            capture(eventName, sanitizeProperties(properties));
        },
        [capture],
    );

    return {
        track,
    };
}
