'use client';

import { usePostHog } from '@posthog/next';
import {
    type MouseEvent,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
} from 'react';
import {
    type FarmAnalyticsCapture,
    type FarmAnalyticsEvent,
    type FarmCompletionSyncStateChangedProperties,
    type FarmNavigationSelectedProperties,
    type FarmTodayFirstActionProperties,
    type FarmTodayTaskOpenedProperties,
    type FarmTodayViewedProperties,
    isFarmNavigationDestination,
    isFarmNavigationSource,
    isFarmTodayTaskAssignment,
    isFarmTodayTaskKind,
    isFarmTodayTaskSource,
    isFarmTodayTaskState,
} from './farmAnalytics';
import {
    FarmAnalyticsContext,
    type FarmAnalyticsContextValue,
} from './farmAnalyticsContext';

type FarmAnalyticsProviderProps = {
    capture?: FarmAnalyticsCapture;
    children: ReactNode;
};

type TodayViewSession = {
    firstActionCaptured: boolean;
    id: number;
};

function getAnalyticsElement(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) {
        return null;
    }

    const analyticsElement = event.target.closest<HTMLElement>(
        '[data-farm-analytics]',
    );

    return analyticsElement && event.currentTarget.contains(analyticsElement)
        ? analyticsElement
        : null;
}

function getTaskOpenedProperties(
    element: HTMLElement,
): FarmTodayTaskOpenedProperties | null {
    const {
        farmTaskAssignment,
        farmTaskKind,
        farmTaskOverdue,
        farmTaskSource,
        farmTaskState,
    } = element.dataset;
    const overdue =
        farmTaskOverdue === 'true'
            ? true
            : farmTaskOverdue === 'false'
              ? false
              : null;

    if (
        !isFarmTodayTaskAssignment(farmTaskAssignment) ||
        !isFarmTodayTaskKind(farmTaskKind) ||
        !isFarmTodayTaskSource(farmTaskSource) ||
        !isFarmTodayTaskState(farmTaskState) ||
        overdue === null
    ) {
        return null;
    }

    return {
        assignment: farmTaskAssignment,
        overdue,
        source: farmTaskSource,
        task_kind: farmTaskKind,
        task_state: farmTaskState,
    };
}

function getNavigationProperties(
    element: HTMLElement,
): FarmNavigationSelectedProperties | null {
    const { farmNavigationDestination, farmNavigationSource } = element.dataset;

    if (
        !isFarmNavigationDestination(farmNavigationDestination) ||
        !isFarmNavigationSource(farmNavigationSource)
    ) {
        return null;
    }

    return {
        destination: farmNavigationDestination,
        source: farmNavigationSource,
    };
}

export function FarmAnalyticsProvider({
    capture,
    children,
}: FarmAnalyticsProviderProps) {
    const posthog = usePostHog();
    const sessionCounter = useRef(0);
    const todayViewSession = useRef<TodayViewSession | null>(null);

    const captureEvent = useCallback(
        (event: FarmAnalyticsEvent) => {
            const properties = {
                ...event.properties,
                surface: 'farm',
            } satisfies Parameters<FarmAnalyticsCapture>[1];

            if (capture) {
                capture(event.name, properties);
                return;
            }

            posthog?.capture(event.name, properties);
        },
        [capture, posthog],
    );

    const captureFirstAction = useCallback(
        (properties: FarmTodayFirstActionProperties) => {
            const session = todayViewSession.current;
            if (!session || session.firstActionCaptured) {
                return;
            }

            session.firstActionCaptured = true;
            captureEvent({
                name: 'farm_today_first_action',
                properties,
            });
        },
        [captureEvent],
    );

    const captureCompletionSyncState = useCallback(
        (properties: FarmCompletionSyncStateChangedProperties) => {
            captureEvent({
                name: 'farm_completion_sync_state_changed',
                properties,
            });
        },
        [captureEvent],
    );

    const handleClickCapture = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            const element = getAnalyticsElement(event);
            if (!element) {
                return;
            }

            if (element.dataset.farmAnalytics === 'today_task') {
                const properties = getTaskOpenedProperties(element);
                if (!properties) {
                    return;
                }

                captureEvent({
                    name: 'farm_today_task_opened',
                    properties,
                });
                captureFirstAction({
                    action_type: 'task_opened',
                    source: properties.source,
                    task_kind: properties.task_kind,
                });
                return;
            }

            if (element.dataset.farmAnalytics === 'navigation') {
                const properties = getNavigationProperties(element);
                if (!properties) {
                    return;
                }

                captureEvent({
                    name: 'farm_navigation_selected',
                    properties,
                });
                captureFirstAction({
                    action_type: 'navigation',
                    destination: properties.destination,
                    source: properties.source,
                });
            }
        },
        [captureEvent, captureFirstAction],
    );

    const mountTodayView = useCallback(
        (properties: FarmTodayViewedProperties, captureView: boolean) => {
            sessionCounter.current += 1;
            const sessionId = sessionCounter.current;
            todayViewSession.current = {
                firstActionCaptured: false,
                id: sessionId,
            };

            if (captureView) {
                captureEvent({
                    name: 'farm_today_viewed',
                    properties,
                });
            }

            return sessionId;
        },
        [captureEvent],
    );

    const unmountTodayView = useCallback((sessionId: number) => {
        if (todayViewSession.current?.id === sessionId) {
            todayViewSession.current = null;
        }
    }, []);

    const contextValue = useMemo<FarmAnalyticsContextValue>(
        () => ({
            captureCompletionSyncState,
            mountTodayView,
            unmountTodayView,
        }),
        [captureCompletionSyncState, mountTodayView, unmountTodayView],
    );

    return (
        <FarmAnalyticsContext.Provider value={contextValue}>
            <div className="contents" onClickCapture={handleClickCapture}>
                {children}
            </div>
        </FarmAnalyticsContext.Provider>
    );
}
