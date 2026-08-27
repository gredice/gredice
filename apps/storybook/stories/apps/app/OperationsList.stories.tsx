import {
    groupOperationsByDay,
    operationsListDayBubbles,
    operationsListDayCounts,
} from '@apps/app/app/admin/operations/operationsListGrouping';
import type { OperationsListOperation } from '@apps/app/app/admin/operations/operationsListTypes';
import {
    canCancelOperationTask,
    canRescheduleOperationTask,
} from '@apps/app/app/admin/schedule/scheduleShared';
import { OperationListItemContent } from '@apps/app/components/operations/OperationListItemContent';
import { OperationsDayGroup } from '@apps/app/components/operations/OperationsDayGroup';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Check, Close } from '@gredice/ui/icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

/**
 * Stand-ins for the real row actions. `OperationListItem` wires these to the
 * reschedule, cancel and verify modals; the story keeps them inert so the
 * layout can be reviewed without pulling server actions into Storybook.
 */
function previewRowActions(operation: OperationsListOperation) {
    if (operation.kind !== 'operation') {
        return null;
    }

    return (
        <>
            {operation.status === 'pendingVerification' ? (
                <IconButton variant="plain" title="Verificiraj operaciju">
                    <Check className="size-4 shrink-0" />
                </IconButton>
            ) : null}
            {canRescheduleOperationTask(operation.status) ? (
                <IconButton variant="plain" title="Prerasporedi radnju">
                    <Calendar className="size-4 shrink-0" />
                </IconButton>
            ) : null}
            {canCancelOperationTask(operation.status) ? (
                <IconButton variant="plain" title="Otkaži operaciju">
                    <Close className="size-4 shrink-0" />
                </IconButton>
            ) : null}
        </>
    );
}

type OperationSeed = {
    label: string;
    category: string;
    status: OperationsListOperation['status'];
    kind?: OperationsListOperation['kind'];
    raisedBedName?: string;
    fieldPosition?: number;
};

function buildOperation(
    seed: OperationSeed,
    dayKey: string,
    index: number,
): OperationsListOperation {
    const timestamp = `${dayKey}T${String(6 + (index % 12)).padStart(2, '0')}:15:00.000Z`;
    const shared = {
        id: index + 1,
        label: seed.label,
        operationDefinition: {
            information: { label: seed.label },
            attributes: {
                category: { information: { name: seed.category } },
            },
        },
        status: seed.status,
        accountUserNames: ['ana.horvat'],
        assignedUserNames: index % 3 === 0 ? ['Farmer One'] : [],
        farmName: 'Farma Zagreb',
        gardenName: 'Vrt Zagreb',
        raisedBedPhysicalId: 'GR-0042',
        raisedBedName: seed.raisedBedName ?? 'Gredica Sjever',
        raisedBedFieldPosition: seed.fieldPosition ?? null,
        timestamp,
        createdAt: timestamp,
        scheduledDate: seed.status === 'planned' ? timestamp : null,
        completedAt: seed.status === 'completed' ? timestamp : null,
    };

    if (seed.kind === 'sowing') {
        return {
            ...shared,
            rowId: `sowing-${dayKey}-${index}`,
            kind: 'sowing',
            entityId: null,
            entityTypeName: 'sowing',
            raisedBedFieldId: 100 + index,
            plantSortId: 700 + index,
            plantCycleEventId: 900 + index,
            sowingLocation: index % 2 === 0 ? 'greenhouse' : 'direct',
        };
    }

    return {
        ...shared,
        rowId: `operation-${dayKey}-${index}`,
        kind: 'operation',
        entityId: 500 + index,
        entityTypeName: 'operation',
        taskVersionEventId: 1000 + index,
    };
}

const daySeeds: Array<{ dayKey: string; seeds: OperationSeed[] }> = [
    {
        dayKey: '2026-08-26',
        seeds: [
            { label: 'Zalijevanje', category: 'watering', status: 'completed' },
            { label: 'Zalijevanje', category: 'watering', status: 'completed' },
            {
                label: 'Zalijevanje',
                category: 'watering',
                status: 'pendingVerification',
            },
            {
                label: 'Sijanje sjemena',
                category: 'sowing',
                status: 'new',
                kind: 'sowing',
                fieldPosition: 4,
            },
            {
                label: 'Sijanje sjemena',
                category: 'sowing',
                status: 'completed',
                kind: 'sowing',
                fieldPosition: 5,
            },
            {
                label: 'Plijevljenje',
                category: 'maintenance',
                status: 'planned',
            },
            { label: 'Berba', category: 'harvest', status: 'planned' },
        ],
    },
    {
        dayKey: '2026-08-25',
        seeds: [
            { label: 'Zalijevanje', category: 'watering', status: 'completed' },
            { label: 'Berba', category: 'harvest', status: 'completed' },
            { label: 'Berba', category: 'harvest', status: 'failed' },
            {
                label: 'Priprema tla',
                category: 'soilPreparation',
                status: 'completed',
                raisedBedName: 'Gredica Jug',
            },
        ],
    },
    {
        dayKey: '2026-08-24',
        seeds: [
            {
                label: 'Sijanje sjemena',
                category: 'sowing',
                status: 'blocked',
                kind: 'sowing',
                fieldPosition: 1,
            },
            { label: 'Zalijevanje', category: 'watering', status: 'canceled' },
        ],
    },
];

const operations = daySeeds.flatMap(({ dayKey, seeds }) =>
    seeds.map((seed, index) => buildOperation(seed, dayKey, index)),
);

const busyDaySeeds: Array<[string, string]> = [
    ['Zalijevanje', 'watering'],
    ['Berba', 'harvest'],
    ['Plijevljenje', 'maintenance'],
    ['Priprema tla', 'soilPreparation'],
    ['Prihrana', 'growth'],
    ['Rezidba', 'flowering'],
    ['Zaštita od nametnika', 'storage'],
    ['Presađivanje', 'planting'],
];

const busyDayOperations = busyDaySeeds.flatMap(([label, category], index) =>
    Array.from({ length: index === 0 ? 6 : 2 }, (_, repeat) =>
        buildOperation(
            { label, category, status: 'completed' },
            '2026-08-26',
            index * 10 + repeat,
        ),
    ),
);

function OperationsListPreview({
    bubbleLimit,
    expandNewestDay,
    operations: previewOperations,
    todayKey,
}: {
    /** How many bubbles a day header shows before collapsing the rest into `+N`. */
    bubbleLimit: number;
    /** Mirrors the list default of opening the newest day. */
    expandNewestDay: boolean;
    /** Records to group, already sorted the way the API returns them. */
    operations: OperationsListOperation[];
    /** Day rendered as "Danas". Fixed here so the story stays deterministic. */
    todayKey: string;
}) {
    const dayGroups = groupOperationsByDay(previewOperations, 'date');
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
        <div className="w-full max-w-5xl">
            <Card>
                <CardOverflow>
                    <ul className="divide-y">
                        {dayGroups.map((group) => (
                            <OperationsDayGroup
                                key={group.dayKey}
                                bubbles={operationsListDayBubbles(
                                    group.operations,
                                    bubbleLimit,
                                )}
                                counts={operationsListDayCounts(
                                    group.operations,
                                )}
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
                                    <OperationListItemContent
                                        key={operation.rowId}
                                        operation={operation}
                                        actions={previewRowActions(operation)}
                                    />
                                ))}
                            </OperationsDayGroup>
                        ))}
                    </ul>
                </CardOverflow>
            </Card>
        </div>
    );
}

const meta = {
    title: 'apps/app/Operations/OperationsList',
    component: OperationsListPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Admin operations list grouped by farm day. Each day header summarises the day with operation bubbles (icon plus record count, sowings tinted green) and expands on click to reveal the matching operation rows.',
            },
        },
    },
    args: {
        bubbleLimit: 6,
        expandNewestDay: true,
        operations,
        todayKey: '2026-08-26',
    },
} satisfies Meta<typeof OperationsListPreview>;

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
                story: 'Every day is collapsed, which is what an operator sees after closing the day that opens by default.',
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
                story: 'A busy day with more operation types than the bubble limit, so the remaining records collapse into a `+N` bubble.',
            },
        },
    },
};

export const SowingHeavyDay: Story = {
    args: {
        operations: operations.filter(
            (operation) => operation.kind === 'sowing',
        ),
    },
    parameters: {
        docs: {
            description: {
                story: 'Planting records only, showing the sowing bubble tint and the operations/sowings split in the day header.',
            },
        },
    },
};

export const SingleOperation: Story = {
    args: {
        operations: operations.slice(0, 1),
    },
};

export const EarlierYear: Story = {
    args: {
        operations: daySeeds[1].seeds.map((seed, index) =>
            buildOperation(seed, '2025-11-18', index),
        ),
        todayKey: '',
    },
    parameters: {
        docs: {
            description: {
                story: 'Records from an earlier year keep the year in the day header and in every row date; dates inside the current year drop it.',
            },
        },
    },
};
