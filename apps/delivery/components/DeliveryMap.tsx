'use client';

import type { DeliveryMapSelection } from '../lib/deliveryMapData';
import { DeliveryInteractiveMap } from './DeliveryInteractiveMap';

const browserApiKey =
    process.env.NEXT_PUBLIC_GREDICE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

export function DeliveryMap({
    mapUrl,
    version,
    title,
    selectedNode,
    onSelectedNodeChange,
}: {
    mapUrl: string;
    version: string | null;
    title: string;
    selectedNode?: DeliveryMapSelection | null;
    onSelectedNodeChange?: (selection: DeliveryMapSelection) => void;
}) {
    return (
        <DeliveryInteractiveMap
            apiKey={browserApiKey}
            mapUrl={mapUrl}
            version={version}
            title={title}
            selectedNode={selectedNode}
            onSelectedNodeChange={onSelectedNodeChange}
        />
    );
}
