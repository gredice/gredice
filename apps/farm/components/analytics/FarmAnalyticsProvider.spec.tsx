import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { FarmTodayView } from '../../app/FarmTodayView';
import type {
    FarmTodayData,
    FarmTodayOperationTask,
} from '../../app/farmTodayModel';
import { FarmAnalyticsHarness } from '../../playwright/FarmAnalyticsHarness';

type AnalyticsEvent = {
    eventName: string;
    properties: Record<string, unknown>;
};

declare global {
    interface Window {
        recordFarmAnalyticsEvent?: (event: unknown) => void;
    }
}

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-analytics-test',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

const privateSentinels = [
    'PRIVATE_OPERATION_LABEL_SENTINEL',
    'PRIVATE_LOCATION_SENTINEL',
    'PRIVATE_HREF_987654321',
    'PRIVATE_TASK_KEY_987654321',
    '987654321',
    'PRIVATE_NOTE_SENTINEL',
    'private.example/photo.jpg',
    'PRIVATE_PHOTO_TOKEN',
    '45.812345',
    '15.976543',
    'PRIVATE_CUSTOMER_CONTENT_SENTINEL',
] as const;

const suspiciousPropertyKey =
    /label|location|href|(^|_)(key|id|ids)($|_)|note|photo|url|coord|content|private/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function exactPropertyKeysForEvent(event: AnalyticsEvent) {
    if (event.eventName === 'farm_navigation_selected') {
        return ['destination', 'source', 'surface'];
    }
    if (event.eventName === 'farm_today_task_opened') {
        return [
            'assignment',
            'overdue',
            'source',
            'surface',
            'task_kind',
            'task_state',
        ];
    }
    if (event.eventName === 'farm_today_first_action') {
        return event.properties.action_type === 'navigation'
            ? ['action_type', 'destination', 'source', 'surface']
            : ['action_type', 'source', 'surface', 'task_kind'];
    }
    if (event.eventName === 'farm_today_viewed') {
        return 'work_state' in event.properties
            ? ['data_status', 'has_next_task', 'surface', 'work_state']
            : ['data_status', 'has_next_task', 'surface'];
    }

    return null;
}

async function captureFarmAnalyticsEvents(page: Page) {
    const analyticsEvents: AnalyticsEvent[] = [];

    await page.exposeFunction('recordFarmAnalyticsEvent', (event: unknown) => {
        if (
            !isRecord(event) ||
            typeof event.eventName !== 'string' ||
            !isRecord(event.properties)
        ) {
            return;
        }

        analyticsEvents.push({
            eventName: event.eventName,
            properties: event.properties,
        });
    });

    await page.evaluate(() => {
        window.addEventListener('gredice:farm-analytics', (event) => {
            if (event instanceof CustomEvent) {
                window.recordFarmAnalyticsEvent?.(event.detail);
            }
        });
    });

    return analyticsEvents;
}

function eventsNamed(analyticsEvents: AnalyticsEvent[], eventName: string) {
    return analyticsEvents.filter((event) => event.eventName === eventName);
}

function expectExactProperties(
    event: AnalyticsEvent,
    expected: Record<string, unknown>,
) {
    expect(event.properties).toEqual(expected);
    expect(Object.keys(event.properties).sort()).toEqual(
        Object.keys(expected).sort(),
    );
}

function buildOperationTask(
    key: string,
    href: string,
    state: FarmTodayOperationTask['state'] = 'actionable',
): FarmTodayOperationTask {
    return {
        ageIndicator: null,
        assignment: 'mine',
        durationMinutes: 15,
        href,
        key,
        kind: 'operation',
        label: `Privatni naziv ${key}`,
        location: {
            farmId: 987654321,
            kind: 'farm',
            label: `Privatna lokacija ${key}`,
        },
        occurredAt: null,
        operationId: 987654321,
        overdue: false,
        proofRequirements: { images: 'required', notes: 'optional' },
        scheduledDate: '2026-07-15T08:00:00.000Z',
        state,
    };
}

test('captures the initial Today view once across rerenders with an exact allowlist', async ({
    mount,
    page,
}) => {
    const analyticsEvents = await captureFarmAnalyticsEvents(page);
    const component = await mount(
        <FarmAnalyticsHarness todayMountKey="stable-today" />,
    );

    await expect
        .poll(() => eventsNamed(analyticsEvents, 'farm_today_viewed').length)
        .toBe(1);

    await component.update(
        <FarmAnalyticsHarness
            dataStatus="partial"
            hasNextTask={false}
            todayMountKey="stable-today"
            workState="allDone"
        />,
    );

    await expect
        .poll(() => eventsNamed(analyticsEvents, 'farm_today_viewed').length)
        .toBe(1);

    const viewedEvent = eventsNamed(analyticsEvents, 'farm_today_viewed')[0];
    expect(viewedEvent).toBeDefined();
    if (!viewedEvent) {
        return;
    }

    expectExactProperties(viewedEvent, {
        data_status: 'ready',
        has_next_task: true,
        surface: 'farm',
        work_state: 'hasWork',
    });
});

test('captures one first recognized action per Today mount without leaking private task data', async ({
    mount,
    page,
}) => {
    const analyticsEvents = await captureFarmAnalyticsEvents(page);
    const component = await mount(
        <FarmAnalyticsHarness todayMountKey="task-first" />,
    );

    await expect
        .poll(() => eventsNamed(analyticsEvents, 'farm_today_viewed').length)
        .toBe(1);

    await component.getByTestId('plain-action').click();
    expect(
        eventsNamed(analyticsEvents, 'farm_today_first_action'),
    ).toHaveLength(0);

    await component.getByTestId('private-task-nested-target').click();
    await expect
        .poll(
            () => eventsNamed(analyticsEvents, 'farm_today_task_opened').length,
        )
        .toBe(1);
    await expect
        .poll(
            () =>
                eventsNamed(analyticsEvents, 'farm_today_first_action').length,
        )
        .toBe(1);

    const taskOpened = eventsNamed(
        analyticsEvents,
        'farm_today_task_opened',
    )[0];
    const taskFirstAction = eventsNamed(
        analyticsEvents,
        'farm_today_first_action',
    )[0];
    expect(taskOpened).toBeDefined();
    expect(taskFirstAction).toBeDefined();
    if (!taskOpened || !taskFirstAction) {
        return;
    }

    expectExactProperties(taskOpened, {
        assignment: 'mine',
        overdue: true,
        source: 'next',
        surface: 'farm',
        task_kind: 'operation',
        task_state: 'actionable',
    });
    expectExactProperties(taskFirstAction, {
        action_type: 'task_opened',
        source: 'next',
        surface: 'farm',
        task_kind: 'operation',
    });

    await component
        .locator('[data-farm-navigation-destination="notifications"]')
        .click();
    await component.getByTestId('private-task-nested-target').click();

    await expect
        .poll(
            () =>
                eventsNamed(analyticsEvents, 'farm_navigation_selected').length,
        )
        .toBe(1);
    await expect
        .poll(
            () => eventsNamed(analyticsEvents, 'farm_today_task_opened').length,
        )
        .toBe(2);
    expect(
        eventsNamed(analyticsEvents, 'farm_today_first_action'),
    ).toHaveLength(1);

    const navigationSelected = eventsNamed(
        analyticsEvents,
        'farm_navigation_selected',
    )[0];
    expect(navigationSelected).toBeDefined();
    if (!navigationSelected) {
        return;
    }
    expectExactProperties(navigationSelected, {
        destination: 'notifications',
        source: 'mobile_bottom',
        surface: 'farm',
    });

    await component.update(
        <FarmAnalyticsHarness todayMountKey="navigation-first" />,
    );
    await expect
        .poll(() => eventsNamed(analyticsEvents, 'farm_today_viewed').length)
        .toBe(2);

    await component.getByTestId('settings-navigation-nested-target').click();
    await expect
        .poll(
            () =>
                eventsNamed(analyticsEvents, 'farm_today_first_action').length,
        )
        .toBe(2);

    const navigationFirstAction = eventsNamed(
        analyticsEvents,
        'farm_today_first_action',
    )[1];
    expect(navigationFirstAction).toBeDefined();
    if (!navigationFirstAction) {
        return;
    }
    expectExactProperties(navigationFirstAction, {
        action_type: 'navigation',
        destination: 'settings',
        source: 'today_tools',
        surface: 'farm',
    });

    await component
        .locator('[data-farm-navigation-destination="notifications"]')
        .click();
    expect(
        eventsNamed(analyticsEvents, 'farm_today_first_action'),
    ).toHaveLength(2);

    const serializedProperties = JSON.stringify(
        analyticsEvents.map((event) => event.properties),
    );
    for (const sentinel of privateSentinels) {
        expect(serializedProperties).not.toContain(sentinel);
    }

    for (const event of analyticsEvents) {
        const allowedKeys = exactPropertyKeysForEvent(event);
        expect(allowedKeys).toBeDefined();
        if (!allowedKeys) {
            continue;
        }

        const actualKeys = Object.keys(event.properties).sort();
        expect(event.properties.surface).toBe('farm');
        expect(actualKeys).toEqual(allowedKeys.sort());

        for (const propertyKey of Object.keys(event.properties)) {
            expect(propertyKey).not.toMatch(suspiciousPropertyKey);
        }
    }
});

test('marks actual Today focus, queue, and attention task links with safe analytics attributes', async ({
    mount,
}) => {
    const nextTask = buildOperationTask(
        'operation:private-next',
        '/operations/801',
    );
    const queuedTask = buildOperationTask(
        'operation:private-queued',
        '/operations/802',
    );
    const attentionTask = buildOperationTask(
        'operation:private-attention',
        '/operations/803',
        'failed',
    );
    const data = {
        attentionItems: [{ reasons: ['failed'], task: attentionTask }],
        dataIssues: [],
        dateKey: '2026-07-15',
        focusQueue: [nextTask, queuedTask],
        status: 'ready',
        summary: {
            assignedToMe: 3,
            completed: 0,
            countsComplete: true,
            overdue: 0,
            pendingVerification: 0,
            remaining: 3,
            remainingDuration: { complete: true, minutes: 45 },
            unassigned: 0,
        },
        workState: 'hasWork',
    } satisfies FarmTodayData;

    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmTodayView data={data} heading={<h1>Danas</h1>} />
        </AppRouterContext.Provider>,
    );

    const nextLink = component.locator('a[href="/operations/801"]');
    const queuedLink = component.locator('a[href="/operations/802"]');
    const attentionLink = component.locator('a[href="/operations/803"]');

    await expect(nextLink).toHaveAttribute('data-farm-analytics', 'today_task');
    await expect(nextLink).toHaveAttribute('data-farm-task-source', 'next');
    await expect(nextLink).toHaveAttribute('data-farm-task-kind', 'operation');
    await expect(nextLink).toHaveAttribute('data-farm-task-assignment', 'mine');
    await expect(nextLink).toHaveAttribute(
        'data-farm-task-state',
        'actionable',
    );
    await expect(nextLink).toHaveAttribute('data-farm-task-overdue', 'false');

    await expect(queuedLink).toHaveAttribute('data-farm-task-source', 'queue');
    await expect(attentionLink).toHaveAttribute(
        'data-farm-task-source',
        'attention',
    );
    await expect(attentionLink).toHaveAttribute(
        'data-farm-task-state',
        'failed',
    );
});
