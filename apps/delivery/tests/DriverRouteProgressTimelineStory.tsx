'use client';

import { useState } from 'react';
import { DriverRouteProgressTimeline } from '../components/DriverRouteProgressTimeline';
import type { DriverRouteTimelineItem } from '../lib/deliveryRouteTimelinePresentation';

const states: DriverRouteTimelineItem['state'][] = [
    'completed',
    'syncing',
    'current',
    'next',
    'retry',
    'exception',
    'locked',
    'completed',
];

const items: DriverRouteTimelineItem[] = Array.from(
    { length: 27 },
    (_, index) => ({
        id: `stop-${index + 1}`,
        sequence: index + 1,
        kind: index === 0 ? 'pickup' : 'delivery',
        state: states[index] ?? 'upcoming',
        title:
            index === 20
                ? 'Skupna dostava s vrlo dugim nazivom primatelja koji mora ostati u retku'
                : index === 0
                  ? 'Glavno sjedište Gredice'
                  : `Primatelj ${index + 1}`,
        destination: `Dostavna adresa ${index + 1}, Zagreb`,
        deliveryCount: index % 3 === 0 ? 3 : 1,
        estimatedArrivalAt: `2026-07-15T${String(8 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}:00.000Z`,
        estimatedTravelSeconds: 300 + index * 30,
    }),
);

export function DriverRouteProgressTimelineStory() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    return (
        <div className="min-h-screen bg-background p-2">
            <section
                data-testid="current-command"
                aria-label="Trenutačna komanda"
                className="sticky top-0 z-10 rounded-lg border bg-background p-3 shadow-sm"
            >
                Trenutačna stanica i primarna akcija
            </section>
            <button
                type="button"
                className="mt-2"
                onClick={() => setSelectedId('stop-5')}
            >
                Odaberi stanicu 5 na karti
            </button>
            <output data-testid="timeline-selection">
                {selectedId ?? 'none'}
            </output>
            <div className="mt-3">
                <DriverRouteProgressTimeline
                    items={items}
                    selectedId={selectedId}
                    onSelectionChange={(item) =>
                        setSelectedId(item?.id ?? null)
                    }
                    renderDetails={(item) => (
                        <div data-testid="route-details">
                            Detalji za {item.id}: primatelj, telefon, urod i
                            napomena.
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
