'use client';

import { useCallback } from 'react';
import { FarmAnalyticsProvider } from '../components/analytics/FarmAnalyticsProvider';
import { FarmTodayViewTracker } from '../components/analytics/FarmTodayViewTracker';
import type {
    FarmAnalyticsCapture,
    FarmTodayDataStatus,
    FarmTodayViewedProperties,
} from '../components/analytics/farmAnalytics';

type FarmAnalyticsHarnessProps = {
    dataStatus?: FarmTodayDataStatus;
    hasNextTask?: boolean;
    todayMountKey?: string;
    workState?: FarmTodayViewedProperties['work_state'];
};

export function FarmAnalyticsHarness({
    dataStatus = 'ready',
    hasNextTask = true,
    todayMountKey = 'initial',
    workState = 'hasWork',
}: FarmAnalyticsHarnessProps) {
    const capture = useCallback<FarmAnalyticsCapture>(
        (eventName, properties) => {
            window.dispatchEvent(
                new CustomEvent('gredice:farm-analytics', {
                    detail: { eventName, properties },
                }),
            );
        },
        [],
    );

    return (
        <FarmAnalyticsProvider capture={capture}>
            <FarmTodayViewTracker
                dataStatus={dataStatus}
                hasNextTask={hasNextTask}
                key={todayMountKey}
                workState={workState}
            />

            <button data-testid="plain-action" type="button">
                Radnja bez analitike
            </button>

            <a
                data-farm-analytics="today_task"
                data-farm-task-assignment="mine"
                data-farm-task-kind="operation"
                data-farm-task-overdue="true"
                data-farm-task-source="next"
                data-farm-task-state="actionable"
                data-farm-today-task="operation:PRIVATE_TASK_KEY_987654321"
                data-private-content="PRIVATE_CUSTOMER_CONTENT_SENTINEL"
                data-private-coordinates="45.812345,15.976543"
                data-private-location="PRIVATE_LOCATION_SENTINEL"
                data-private-note="PRIVATE_NOTE_SENTINEL"
                data-private-operation-id="987654321"
                data-private-photo-url="https://private.example/photo.jpg?token=PRIVATE_PHOTO_TOKEN"
                href="/operations/PRIVATE_HREF_987654321?note=PRIVATE_NOTE_SENTINEL"
                onClick={(event) => event.preventDefault()}
            >
                <span data-testid="private-task-nested-target">
                    PRIVATE_OPERATION_LABEL_SENTINEL
                </span>
                <span>PRIVATE_LOCATION_SENTINEL</span>
            </a>

            <a
                data-farm-analytics="navigation"
                data-farm-navigation-destination="notifications"
                data-farm-navigation-source="mobile_bottom"
                href="/notifications"
                onClick={(event) => event.preventDefault()}
            >
                Obavijesti
            </a>

            <a
                data-farm-analytics="navigation"
                data-farm-navigation-destination="settings"
                data-farm-navigation-source="today_tools"
                href="/settings"
                onClick={(event) => event.preventDefault()}
            >
                <span data-testid="settings-navigation-nested-target">
                    Postavke
                </span>
            </a>
        </FarmAnalyticsProvider>
    );
}
