'use client';

import { DeliveryInteractiveMap } from './DeliveryInteractiveMap';

const browserApiKey =
    process.env.NEXT_PUBLIC_GREDICE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

export function DeliveryMap({
    mapUrl,
    version,
    title,
}: {
    mapUrl: string;
    version: string | null;
    title: string;
}) {
    return (
        <DeliveryInteractiveMap
            apiKey={browserApiKey}
            mapUrl={mapUrl}
            version={version}
            title={title}
        />
    );
}
