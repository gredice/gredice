'use client';

import { useEffect, useRef, useState } from 'react';
import type {
    FarmTodayDataStatus,
    FarmTodayViewedProperties,
} from './farmAnalytics';
import { useFarmAnalytics } from './farmAnalyticsContext';

type FarmTodayViewTrackerProps = {
    dataStatus: FarmTodayDataStatus;
    hasNextTask: boolean;
    workState?: FarmTodayViewedProperties['work_state'];
};

export function FarmTodayViewTracker({
    dataStatus,
    hasNextTask,
    workState,
}: FarmTodayViewTrackerProps) {
    const analytics = useFarmAnalytics();
    const capturedView = useRef(false);
    const [initialProperties] = useState<FarmTodayViewedProperties>(() =>
        workState
            ? {
                  data_status: dataStatus,
                  has_next_task: hasNextTask,
                  work_state: workState,
              }
            : {
                  data_status: dataStatus,
                  has_next_task: hasNextTask,
              },
    );

    useEffect(() => {
        if (!analytics) {
            return;
        }

        const sessionId = analytics.mountTodayView(
            initialProperties,
            !capturedView.current,
        );
        capturedView.current = true;

        return () => analytics.unmountTodayView(sessionId);
    }, [analytics, initialProperties]);

    return null;
}
