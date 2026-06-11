import { useState } from 'react';
import {
    formatGardenVisitSummaryFacts,
    type GardenVisitSummaryFact,
} from '../../../packages/game/src/hooks/gardenVisitSummary';
import { GardenVisitSummaryModalContent } from '../../../packages/game/src/hud/GardenVisitSummaryModal';

const now = '2026-06-10T10:00:00.000Z';

const displayItems = formatGardenVisitSummaryFacts([
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
] satisfies GardenVisitSummaryFact[]);

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
