import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { FarmTodayView } from '../app/FarmTodayView';
import type {
    FarmTodayData,
    FarmTodayOperationTask,
} from '../app/farmTodayModel';
import { FarmPrimaryNavigation } from '../components/navigation/FarmPrimaryNavigation';

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-pwa-preview',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

const focusTask = {
    actionTarget: null,
    ageIndicator: null,
    assignment: 'mine',
    durationMinutes: 20,
    href: '/operations/701',
    key: 'operation:701',
    kind: 'operation',
    label: 'Pregledaj sustav navodnjavanja',
    location: {
        farmId: 1,
        groupKey: 'A12|garden-1|account-1',
        kind: 'raisedBed',
        label: 'Gredica A12 · pozicija 3',
        physicalId: 'A12',
        positionIndex: 2,
        positionNumber: 3,
        raisedBedId: 12,
    },
    occurredAt: null,
    operationId: 701,
    operationDefinitionAvailable: true,
    overdue: false,
    proofRequirements: { images: 'required', notes: 'optional' },
    scheduledDate: '2026-07-15T08:00:00.000Z',
    state: 'actionable',
} satisfies FarmTodayOperationTask;

const previewData = {
    attentionItems: [],
    dataIssues: [],
    dateKey: '2026-07-15',
    focusQueue: [focusTask],
    status: 'ready',
    summary: {
        assignedToMe: 2,
        completed: 3,
        countsComplete: true,
        overdue: 0,
        pendingVerification: 0,
        remaining: 2,
        remainingDuration: { complete: true, minutes: 35 },
        unassigned: 0,
    },
    workState: 'hasWork',
} satisfies FarmTodayData;

export function PwaInstallPreview() {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <div className="flex min-h-screen min-w-0 flex-col bg-background text-foreground">
                <div className="min-w-0 flex-1 pb-[calc(var(--farm-mobile-navigation-height,3.5rem)+1px)] md:pb-0">
                    <FarmTodayView
                        data={previewData}
                        heading={
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Srijeda, 15. srpnja
                                </p>
                                <h1 className="text-2xl font-semibold">
                                    Dnevni zadaci
                                </h1>
                            </div>
                        }
                    />
                </div>
                <FarmPrimaryNavigation hasUnreadNotifications pathname="/" />
            </div>
        </AppRouterContext.Provider>
    );
}
