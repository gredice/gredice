'use client';

import { clientPublic } from '@gredice/client';
import { getGardenBaseUrl } from '@gredice/js/urls';
import { Button } from '@gredice/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { LandingPublicGardenViewer } from './LandingPublicGardenViewer';
import type { LandingGarden } from './landingGardenCarousel';
import { PublicGardenPreviewImage } from './vrtovi/PublicGardenPreviewImage';

/** Only the displayed garden needs its full interactive scene. */
export function LandingFeaturedGardenScene({
    garden,
}: {
    garden: LandingGarden;
}) {
    const [sceneReady, setSceneReady] = useState(false);
    const details = useQuery({
        queryKey: ['landing', 'public-garden', garden.garden.id],
        queryFn: async ({ signal }) => {
            const response = await clientPublic().api.gardens[
                ':gardenId'
            ].public.$get(
                { param: { gardenId: garden.garden.id.toString() } },
                {
                    init: {
                        signal: AbortSignal.any([
                            signal,
                            AbortSignal.timeout(10_000),
                        ]),
                    },
                },
            );
            if (!response.ok) throw new Error('Failed to load public garden.');
            return response.json();
        },
        enabled: garden.source === 'featured',
        staleTime: 60 * 1000,
        retry: 1,
    });
    const scene = garden.source === 'owned' ? garden.garden : details.data;

    return (
        <div className="relative size-full">
            {scene ? (
                <LandingPublicGardenViewer
                    appBaseUrl={getGardenBaseUrl()}
                    className="size-full"
                    deferDetails
                    garden={scene}
                    noControls
                    noSound
                    onSceneReady={() => setSceneReady(true)}
                />
            ) : null}
            {!sceneReady && garden.source === 'featured' ? (
                <div className="pointer-events-none absolute inset-0">
                    <PublicGardenPreviewImage
                        className="h-full"
                        dayPreviewImageUrl={garden.dayPreviewImageUrl}
                        nightPreviewImageUrl={garden.nightPreviewImageUrl}
                        gardenName={garden.garden.name}
                        sizes="(min-width: 1280px) 1280px, 100vw"
                        priority
                    />
                </div>
            ) : null}
            {details.isError && garden.source === 'featured' ? (
                <div
                    role="status"
                    className="absolute inset-x-0 top-1/3 flex justify-center"
                >
                    <Button
                        type="button"
                        variant="outlined"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => void details.refetch()}
                    >
                        Ponovno učitaj prikaz vrta
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
