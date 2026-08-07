'use client';

import { createContext, useContext } from 'react';
import type {
    FarmCompletionSyncStateChangedProperties,
    FarmTodayViewedProperties,
} from './farmAnalytics';

export type FarmAnalyticsContextValue = {
    captureCompletionSyncState: (
        properties: FarmCompletionSyncStateChangedProperties,
    ) => void;
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
