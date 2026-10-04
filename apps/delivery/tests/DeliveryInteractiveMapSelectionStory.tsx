'use client';

import { useState } from 'react';
import { DeliveryInteractiveMap } from '../components/DeliveryInteractiveMap';
import type { DeliveryMapSelection } from '../lib/deliveryMapData';
import { deliveryMapSelectionKey } from '../lib/deliveryMapData';

export function DeliveryInteractiveMapSelectionStory() {
    const [selectedNode, setSelectedNode] =
        useState<DeliveryMapSelection | null>(null);
    return (
        <div>
            <DeliveryInteractiveMap
                apiKey="browser-test-key"
                mapUrl="/api/map/run-interactive"
                version="2026-07-15T14:00:00.000Z"
                title="Interaktivna karta dostave"
                selectedNode={selectedNode}
                onSelectedNodeChange={setSelectedNode}
            />
            <output data-testid="map-selection">
                {deliveryMapSelectionKey(selectedNode) ?? 'none'}
            </output>
            <button
                type="button"
                onClick={() =>
                    setSelectedNode({
                        kind: 'delivery',
                        id: 'completed-stop-without-marker',
                    })
                }
            >
                Odaberi dovršenu stanicu bez markera
            </button>
        </div>
    );
}
