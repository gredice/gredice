'use client';

import { createContext, useContext } from 'react';
import type { FarmTodayViewedProperties } from './farmAnalytics';

export type FarmAnalyticsContextValue = {
    mountTodayView: (
        properties: FarmTodayViewedProperties,
        captureView: boolean,
    ) => number;
    unmountTodayView: (sessionId: number) => void;
};

export const FarmAnalyticsContext =
    createContext<FarmAnalyticsContextValue | null>(null);

export function useFarmAnalytics() {
    return useContext(FarmAnalyticsContext);
}
