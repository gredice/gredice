import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    formatGardenVisitSummaryFacts,
    type GardenVisitSummaryFact,
    gardenVisitSummaryQueryKey,
} from '../../../packages/game/src/hooks/gardenVisitSummary';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { queryKey as currentUserQueryKey } from '../../../packages/game/src/hooks/useCurrentUser';
import { dailyRewardKeys } from '../../../packages/game/src/hooks/useDailyReward';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { whatsNewEntriesQueryKey } from '../../../packages/game/src/hooks/useWhatsNewEntries';
import {
    GardenVisitSummaryModal,
    GardenVisitSummaryModalContent,
} from '../../../packages/game/src/hud/GardenVisitSummaryModal';
import { WelcomeMessage } from '../../../packages/game/src/hud/WelcomeMessage';
import { WhatsNewWidget } from '../../../packages/game/src/hud/WhatsNewWidget';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-06-10T10:00:00.000Z';
const TEST_GARDEN_ID = 3336;

const summaryFacts = [
    {
        id: 'weed-1',
        type: 'weed',
        priority: 100,
        occurredAt: now,
        confidence: 'high',
        source: {
            type: 'weedState',
            id: 'weed-1',
            observedAt: now,
        },
        target: {
            raisedBedId: 7,
            raisedBedName: 'Sjeverna gredica',
            fieldId: 70,
            positionIndex: 3,
        },
        count: 4,
        visualHint: 'field',
    },
    {
        id: 'growth-1',
        type: 'plantGrowth',
        priority: 70,
        occurredAt: '2026-06-10T08:00:00.000Z',
        confidence: 'high',
        source: {
            type: 'plantLifecycle',
            id: 'field:70:growth',
            observedAt: '2026-06-10T08:00:00.000Z',
        },
        plant: {
            plantName: 'Rajčica',
            sortName: 'Rajčica',
        },
        target: {
            raisedBedId: 7,
            raisedBedName: 'Sjeverna gredica',
            fieldId: 70,
            positionIndex: 3,
        },
        visualHint: 'field',
    },
] satisfies GardenVisitSummaryFact[];

const displayItems = formatGardenVisitSummaryFacts(summaryFacts);

const longNameDisplayItems = formatGardenVisitSummaryFacts([
    {
        id: 'long-harvest-1',
        type: 'harvestWindow',
        priority: 90,
        occurredAt: now,
        confidence: 'high',
        source: {
            type: 'harvestWindow',
            id: 'harvest-window-long-name',
            observedAt: now,
        },
        plant: {
            plantName:
                'Rajčica volovsko srce ekstra rana crvena selekcija obitelji Horvat',
            sortName:
                'Rajčica volovsko srce ekstra rana crvena selekcija obitelji Horvat',
        },
        target: {
            raisedBedId: 7,
            raisedBedName: 'Sjeverna gredica s jako dugim nazivom lokacije',
            fieldId: 70,
            positionIndex: 3,
        },
        range: { min: 3, max: 5, unit: 'days' },
        visualHint: 'field',
    },
    {
        id: 'long-support-1',
        type: 'supportNeeded',
        priority: 80,
        occurredAt: now,
        confidence: 'high',
        source: {
            type: 'operation',
            id: 'support-long-name',
            observedAt: now,
        },
        plant: {
            plantName: 'Krastavac salatni vrlo dugi naziv sorte za uske ekrane',
            sortName: 'Krastavac salatni vrlo dugi naziv sorte za uske ekrane',
        },
        target: {
            raisedBedId: 8,
            raisedBedName: 'Južna gredica',
            fieldId: 80,
            positionIndex: 1,
        },
        visualHint: 'field',
    },
] satisfies GardenVisitSummaryFact[]);

const currentUser = {
    avatarUrl: null,
    birthday: null,
    birthdayLastRewardAt: null,
    birthdayLastUpdatedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    displayName: 'Test User',
    email: 'test@example.com',
    id: 'test-user',
    userName: 'test-user',
    whatsNewLastSeenAt: null,
    whatsNewPopupDisabled: false,
};

const whatsNewEntry = {
    canonicalPath: '/novosti/sto-je-novo/vrt-je-zivlji',
    category: null,
    cmsSlug: 'novosti/sto-je-novo/vrt-je-zivlji',
    contentKind: 'changelog',
    excerpt: 'Vrt sada jasnije pokazuje što se promijenilo.',
    id: 3336,
    metaDescription: 'Vrt sada jasnije pokazuje što se promijenilo.',
    metaImageUrl: null,
    metaTitle: 'Vrt je življi',
    noIndex: false,
    path: '/novosti/sto-je-novo/vrt-je-zivlji',
    publishedAt: new Date('2026-06-10T08:00:00.000Z'),
    seoImageUrl: null,
    slug: 'vrt-je-zivlji',
    tags: ['Vrt'],
    title: 'Vrt je življi',
    updatedAt: new Date('2026-06-10T08:00:00.000Z'),
};

function dailyReward(canClaim: boolean) {
    return {
        canClaim,
        current: { amount: canClaim ? 5 : 0, day: 1 },
        next: { amount: 10, day: 2 },
        streak: [],
        expiresAt: '2026-06-11T22:00:00.000Z',
    };
}

function openingFlowGarden() {
    return {
        id: TEST_GARDEN_ID,
        name: 'QA garden',
        backgroundPalette: 'default',
        farmId: null,
        isSandbox: false,
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
        stacks: [],
    };
}

function createOpeningFlowQueryClient({
    dailyRewardCanClaim,
    facts,
    factsHash,
}: {
    dailyRewardCanClaim: boolean;
    facts: GardenVisitSummaryFact[];
    factsHash: string | null;
}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = openingFlowGarden();

    queryClient.setQueryData(useGardensKeys, [
        { id: TEST_GARDEN_ID, name: garden.name },
    ]);
    queryClient.setQueryData(
        currentGardenKeys('summer', TEST_GARDEN_ID),
        garden,
    );
    queryClient.setQueryData(dailyRewardKeys, dailyReward(dailyRewardCanClaim));
    queryClient.setQueryData(currentUserQueryKey.currentUser, currentUser);
    queryClient.setQueryData(gardenVisitSummaryQueryKey(TEST_GARDEN_ID), {
        window: {
            firstVisit: facts.length === 0,
            since: facts.length > 0 ? '2026-06-09T10:00:00.000Z' : null,
            until: now,
        },
        facts,
        factsHash,
        state: null,
    });
    queryClient.setQueryData(
        [...whatsNewEntriesQueryKey, { limit: 8, since: null }],
        [whatsNewEntry],
    );

    return queryClient;
}

function OpeningFlowProviders({
    children,
    dailyRewardCanClaim,
    facts,
    factsHash,
}: PropsWithChildren<{
    dailyRewardCanClaim: boolean;
    facts: GardenVisitSummaryFact[];
    factsHash: string | null;
}>) {
    const queryClient = useMemo(
        () =>
            createOpeningFlowQueryClient({
                dailyRewardCanClaim,
                facts,
                factsHash,
            }),
        [dailyRewardCanClaim, facts, factsHash],
    );
    const gameState = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: new Date('2026-06-10T10:00:00.000Z'),
                isMock: false,
            }),
        [],
    );

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameState}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        {children}
                    </GameAnalyticsProvider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function OpeningFlowHarness() {
    const [welcomeConfirmed, setWelcomeConfirmed] = useState(false);
    const [visitSummaryConfirmed, setVisitSummaryConfirmed] = useState(false);
    const summaryEnabled = welcomeConfirmed && !visitSummaryConfirmed;
    const openingFlowComplete = welcomeConfirmed && visitSummaryConfirmed;

    return (
        <div className="relative h-[640px] w-[720px] bg-background">
            <WelcomeMessage onClosed={() => setWelcomeConfirmed(true)} />
            <GardenVisitSummaryModal
                enabled={summaryEnabled}
                onClosed={() => setVisitSummaryConfirmed(true)}
            />
            <WhatsNewWidget enabled={openingFlowComplete} />
            <output data-testid="opening-flow-state" className="sr-only">
                {[
                    welcomeConfirmed ? 'welcome:closed' : 'welcome:open',
                    visitSummaryConfirmed ? 'summary:closed' : 'summary:open',
                    openingFlowComplete ? 'whats-new:enabled' : 'whats-new:off',
                ].join('|')}
            </output>
        </div>
    );
}

export function VisitSummaryModalFixture() {
    const [open, setOpen] = useState(true);
    const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);

    return (
        <div className="relative h-[560px] w-[720px] bg-background">
            <GardenVisitSummaryModalContent
                displayItems={displayItems}
                onClose={() => setOpen(false)}
                onInspect={(item) => setInspectedItemId(item.id)}
                open={open}
            />
            {inspectedItemId ? (
                <output aria-live="polite" className="sr-only">
                    {inspectedItemId}
                </output>
            ) : null}
        </div>
    );
}

export function LongVisitSummaryModalFixture() {
    const [open, setOpen] = useState(true);

    return (
        <div className="relative min-h-[640px] w-full bg-background">
            <GardenVisitSummaryModalContent
                displayItems={longNameDisplayItems}
                onClose={() => setOpen(false)}
                open={open}
            />
        </div>
    );
}

export function VisitSummaryOpeningFlowFixture({
    dailyRewardCanClaim = false,
    facts = summaryFacts,
    factsHash = 'summary-fixture-hash',
}: {
    dailyRewardCanClaim?: boolean;
    facts?: GardenVisitSummaryFact[];
    factsHash?: string | null;
}) {
    return (
        <OpeningFlowProviders
            dailyRewardCanClaim={dailyRewardCanClaim}
            facts={facts}
            factsHash={factsHash}
        >
            <OpeningFlowHarness />
        </OpeningFlowProviders>
    );
}
