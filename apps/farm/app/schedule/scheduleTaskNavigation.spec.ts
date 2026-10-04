import { expect, test } from '@playwright/test';
import {
    buildScheduleTaskGuidanceHref,
    getScheduleTaskReturnHref,
} from './scheduleTaskNavigation';

test('keeps handbook entity IDs separate from viewed-date task context', () => {
    expect(
        buildScheduleTaskGuidanceHref({
            dateKey: '2026-07-20',
            guidancePath: '/operations/1001',
            taskId: 41,
        }),
    ).toBe('/operations/1001?scheduleDate=2026-07-20&scheduleTask=41');
    expect(
        buildScheduleTaskGuidanceHref({
            dateKey: '2026-07-20',
            guidancePath: '/plants/501',
            taskId: 81,
        }),
    ).toBe('/plants/501?scheduleDate=2026-07-20&scheduleTask=81');
});

test('builds validated operation and planting return anchors', () => {
    expect(
        getScheduleTaskReturnHref({
            dateKey: '2026-07-20',
            kind: 'operation',
            taskId: '41',
        }),
    ).toBe('/schedule?date=2026-07-20#schedule-task-operation-41');
    expect(
        getScheduleTaskReturnHref({
            dateKey: '2026-07-20',
            kind: 'planting',
            taskId: '81',
        }),
    ).toBe('/schedule?date=2026-07-20#schedule-task-planting-81');
});

test('rejects invalid or repeated schedule return parameters', () => {
    const invalidContexts = [
        { dateKey: '2026-02-30', taskId: '1' },
        { dateKey: '2026-07-20', taskId: '0' },
        { dateKey: '2026-07-20', taskId: '-1' },
        { dateKey: '2026-07-20', taskId: '1.5' },
        { dateKey: '2026-07-20', taskId: '01' },
        { dateKey: '2026-07-20', taskId: '9007199254740992' },
        { dateKey: ['2026-07-20', '2026-07-21'], taskId: '1' },
        { dateKey: '2026-07-20', taskId: ['1', '2'] },
    ];

    for (const context of invalidContexts) {
        expect(
            getScheduleTaskReturnHref({
                ...context,
                kind: 'operation',
            }),
        ).toBeNull();
    }
});
