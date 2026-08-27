import { cartOperation } from '@apps/garden/tests/GardenOperationsHudStory';
import type { GardenOperationItem } from '@packages/game/hooks/useGardenOperations';
import type { GardenOperationsBubbleItem } from '@packages/game/hud/GardenOperationsDayBubbles';
import { GardenOperationsDayGroup } from '@packages/game/hud/GardenOperationsDayGroup';
import { GardenOperationCard } from '@packages/game/hud/GardenOperationsHud';
import {
    gardenOperationsDayBubbles,
    gardenOperationsDayCounts,
    groupGardenOperationsByDay,
} from '@packages/game/hud/gardenOperationsDayGrouping';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const referenceDate = new Date('2026-08-26T12:00:00.000Z');

function operationDefinition(label: string, stageName: string) {
    return {
        ...cartOperation,
        id: cartOperation.id,
        attributes: {
            ...cartOperation.attributes,
            stage: { id: 1, information: { name: stageName, label } },
        },
        information: { ...cartOperation.information, label },
    };
}

const operationDefinitions = new Map(
    [
        ['Zalijevanje', 'watering'],
        ['Berba', 'harvest'],
        ['Plijevljenje', 'maintenance'],
        ['Priprema tla', 'soilPreparation'],
        ['Prihrana', 'growth'],
        ['Rezidba', 'flowering'],
        ['Presađivanje', 'planting'],
    ].map(([label, stageName]) => [
        label,
        operationDefinition(label, stageName),
    ]),
);

let operationCounter = 0;

function buildOperation({
    completedAt,
    label,
    status = 'completed',
}: {
    completedAt: string;
    label: string;
    status?: GardenOperationItem['status'];
}): GardenOperationItem {
    operationCounter += 1;

    return {
        id: operationCounter,
        entityId: cartOperation.id,
        taskVersionEventId: null,
        entityTypeName: 'operation',
        raisedBedId: 1,
        raisedBedFieldId: 1,
        status,
        createdAt: completedAt,
        scheduledDate: status === 'completed' ? null : completedAt,
        scheduledAt: null,
        completedAt: status === 'completed' ? completedAt : null,
        verifiedAt: null,
        canceledAt: null,
        cancellationReason: null,
        blockedAt: null,
        blockReasonLabel: null,
        blockNote: null,
        blockImageUrls: [],
        imageUrls: [],
        completionNotes: null,
        targetLabel: label,
        statusHistory: [],
    };
}

function dayOperations(day: string, labels: string[]) {
    return labels.map((label, index) =>
        buildOperation({
            completedAt: `${day}T${String(7 + index).padStart(2, '0')}:00:00.000Z`,
            label,
        }),
    );
}

const defaultOperations = [
    ...dayOperations('2026-08-26', [
        'Zalijevanje',
        'Zalijevanje',
        'Zalijevanje',
        'Berba',
    ]),
    ...dayOperations('2026-08-25', [
        'Zalijevanje',
        'Plijevljenje',
        'Priprema tla',
    ]),
    ...dayOperations('2026-08-24', ['Prihrana']),
];

const busyDayOperations = dayOperations('2026-08-26', [
    'Zalijevanje',
    'Zalijevanje',
    'Zalijevanje',
    'Zalijevanje',
    'Berba',
    'Berba',
    'Plijevljenje',
    'Priprema tla',
    'Prihrana',
    'Rezidba',
    'Presađivanje',
]);

const earlierYearOperations = dayOperations('2025-11-18', [
    'Zalijevanje',
    'Berba',
]);

function bubbleItemsFor(
    operations: GardenOperationItem[],
): GardenOperationsBubbleItem[] {
    return operations.map((operation) => ({
        kind: 'operation',
        label: operation.targetLabel,
        operationData: operationDefinitions.get(operation.targetLabel),
    }));
}

/**
 * Mirrors how `GardenOperationsHud` renders its lists: real day grouping around
 * real `GardenOperationCard`s, only the garden data is mocked.
 */
function GardenOperationsDayGroupPreview({
    bubbleLimit,
    expandNewestDay,
    operations,
    todayKey,
}: {
    /** How many bubbles a day shows before the rest collapse into `+N`. */
    bubbleLimit: number;
    /** Mirrors the history default of opening the newest day. */
    expandNewestDay: boolean;
    /** Records to group, newest first, as the HUD delivers them. */
    operations: GardenOperationItem[];
    /** Day rendered as "Danas". Fixed here so the story stays deterministic. */
    todayKey: string;
}) {
    const dayGroups = groupGardenOperationsByDay(operations);
    const [overrides, setOverrides] = useState<Map<string, boolean>>(
        () => new Map(),
    );

    function isDayExpanded(dayKey: string) {
        return (
            overrides.get(dayKey) ??
            (dayKey === todayKey ||
                (expandNewestDay && dayKey === dayGroups[0]?.dayKey))
        );
    }

    return (
        <div className="w-full max-w-2xl">
            {dayGroups.map((group) => {
                const bubbleItems = bubbleItemsFor(group.operations);

                return (
                    <GardenOperationsDayGroup
                        key={group.dayKey}
                        bubbles={gardenOperationsDayBubbles(
                            bubbleItems,
                            bubbleLimit,
                        )}
                        counts={gardenOperationsDayCounts(bubbleItems)}
                        dayKey={group.dayKey}
                        isExpanded={isDayExpanded(group.dayKey)}
                        isToday={group.dayKey === todayKey}
                        onToggle={(dayKey) =>
                            setOverrides((previous) =>
                                new Map(previous).set(
                                    dayKey,
                                    !isDayExpanded(dayKey),
                                ),
                            )
                        }
                    >
                        {group.operations.map((operation) => (
                            <GardenOperationCard
                                key={operation.id}
                                operation={operation}
                                operationName={operation.targetLabel}
                                operationData={operationDefinitions.get(
                                    operation.targetLabel,
                                )}
                                referenceDate={referenceDate}
                            />
                        ))}
                    </GardenOperationsDayGroup>
                );
            })}
        </div>
    );
}

const meta = {
    title: 'packages/game/HUD/GardenOperationsDayGroup',
    component: GardenOperationsDayGroupPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Day grouping used by both garden operation lists — the upcoming list in the HUD popover and the full "Povijest radnji" history. Each day summarises itself with bubbles (one per distinct operation, with its record count) and expands on click to reveal the operation cards.',
            },
        },
    },
    args: {
        bubbleLimit: 6,
        expandNewestDay: true,
        operations: defaultOperations,
        todayKey: '2026-08-26',
    },
} satisfies Meta<typeof GardenOperationsDayGroupPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllDaysCollapsed: Story = {
    args: {
        expandNewestDay: false,
        todayKey: '',
    },
    parameters: {
        docs: {
            description: {
                story: 'Every day collapsed — the overview an owner scans before opening a day.',
            },
        },
    },
};

export const BubbleOverflow: Story = {
    args: {
        operations: busyDayOperations,
    },
    parameters: {
        docs: {
            description: {
                story: 'A busy day with more distinct operations than the bubble limit, so the rest collapse into a `+N` bubble.',
            },
        },
    },
};

export const EarlierYear: Story = {
    args: {
        operations: earlierYearOperations,
        todayKey: '',
    },
    parameters: {
        docs: {
            description: {
                story: 'Days outside the current year keep the year in the label; recent days drop it.',
            },
        },
    },
};
