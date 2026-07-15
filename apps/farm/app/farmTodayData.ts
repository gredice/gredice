import 'server-only';

import { getFarmsForUser, getTimeZoneDateKey } from '@gredice/storage';
import { cache } from 'react';
import {
    composeFarmTodayData,
    type FarmTodayData,
    type FarmTodayOperationsSourceData,
    type FarmTodaySource,
} from './farmTodayModel';
import {
    getFarmScheduleOperationsData,
    getFarmScheduleOperationsForDay,
    getFarmSchedulePendingOperations,
    getFarmSchedulePlantingsDayData,
    getFarmSchedulePlantSorts,
} from './schedule/scheduleData';
import { FARM_SCHEDULE_TIME_ZONE } from './schedule/scheduleShared';

function toSource<T>(result: PromiseSettledResult<T>): FarmTodaySource<T> {
    return result.status === 'fulfilled'
        ? { status: 'ready', data: result.value }
        : { status: 'unavailable' };
}

function logRejectedSource(
    source: string,
    result: PromiseSettledResult<unknown>,
) {
    if (result.status === 'rejected') {
        console.error(`[Farm Today] ${source} unavailable`, result.reason);
    }
}

export const getFarmTodayData = cache(
    async (userId: string): Promise<FarmTodayData> => {
        const referenceDate = new Date();
        const dateKey = getTimeZoneDateKey(
            referenceDate,
            FARM_SCHEDULE_TIME_ZONE,
        );

        const farmsResult = await Promise.allSettled([getFarmsForUser(userId)]);
        logRejectedSource('farms', farmsResult[0]);
        const farms = toSource(farmsResult[0]);

        if (farms.status === 'unavailable') {
            return {
                dataIssues: ['farmsUnavailable'],
                dateKey,
                status: 'unavailable',
            };
        }

        if (farms.data.length === 0) {
            return {
                dataIssues: [],
                dateKey,
                status: 'noFarm',
            };
        }

        const [
            plantingsResult,
            scheduledOperationsResult,
            pendingOperationsResult,
            plantSortsResult,
            operationDefinitionsResult,
        ] = await Promise.allSettled([
            getFarmSchedulePlantingsDayData(userId, dateKey, true),
            getFarmScheduleOperationsForDay(userId, dateKey, true),
            getFarmSchedulePendingOperations(userId),
            getFarmSchedulePlantSorts(),
            getFarmScheduleOperationsData(),
        ]);
        logRejectedSource('plantings', plantingsResult);
        logRejectedSource('scheduled operations', scheduledOperationsResult);
        logRejectedSource('pending operations', pendingOperationsResult);
        logRejectedSource('plant sorts', plantSortsResult);
        logRejectedSource('operation definitions', operationDefinitionsResult);

        const operations: FarmTodaySource<FarmTodayOperationsSourceData> =
            scheduledOperationsResult.status === 'rejected' &&
            pendingOperationsResult.status === 'rejected'
                ? { status: 'unavailable' }
                : {
                      status: 'ready',
                      data: {
                          pendingOperations:
                              pendingOperationsResult.status === 'fulfilled'
                                  ? pendingOperationsResult.value
                                  : [],
                          pendingOperationsComplete:
                              pendingOperationsResult.status === 'fulfilled',
                          raisedBeds:
                              plantingsResult.status === 'fulfilled'
                                  ? plantingsResult.value.raisedBeds
                                  : [],
                          scheduledOperations:
                              scheduledOperationsResult.status === 'fulfilled'
                                  ? scheduledOperationsResult.value
                                  : [],
                          scheduledOperationsComplete:
                              scheduledOperationsResult.status === 'fulfilled',
                      },
                  };

        return composeFarmTodayData({
            dateKey,
            farms: { status: 'ready', data: farms.data },
            operationDefinitions: toSource(operationDefinitionsResult),
            operations,
            plantings: toSource(plantingsResult),
            plantSorts: toSource(plantSortsResult),
            referenceDate,
            userId,
        });
    },
);
