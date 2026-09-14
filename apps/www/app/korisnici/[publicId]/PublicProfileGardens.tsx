'use client';

import { clientPublic, directoriesClient } from '@gredice/client';
import {
    GardenSceneTransitionSurface,
    useGardenSceneTransition,
} from '@gredice/game/garden-scene-transition';
import { Button } from '@gredice/ui/Button';
import { Spinner } from '@gredice/ui/Spinner';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PublicGardenStatsAccordion } from '../../vrtovi/PublicGardenStatsAccordion';
import { PublicGardenSummary } from '../../vrtovi/PublicGardenSummary';
import {
    calculatePublicGardenStats,
    countActivePlantsFromPublicGarden,
} from '../../vrtovi/publicGardenFormatting';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';
import type { getPublicProfile } from './publicProfile';

export function PublicProfileGardens({
    gardens,
}: Pick<Awaited<ReturnType<typeof getPublicProfile>>, 'gardens'>) {
    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );
    const activeGarden =
        gardens.find((garden) => garden.id === selectedGardenId) ?? gardens[0];
    const blockDataQuery = useQuery({
        queryKey: ['public-garden-stat-blocks'],
        enabled: Boolean(activeGarden),
        queryFn: async () =>
            (await directoriesClient().GET('/entities/block')).data ?? null,
        staleTime: 60 * 60 * 1000,
        retry: false,
    });
    const gardenQuery = useQuery({
        queryKey: ['public-garden', activeGarden?.id],
        enabled: Boolean(activeGarden),
        queryFn: async () => {
            const response = await clientPublic().api.gardens[
                ':gardenId'
            ].public.$get({
                param: { gardenId: String(activeGarden?.id) },
            });
            if (!response.ok) {
                throw new Error('Vrt nije dostupan.');
            }
            return response.json();
        },
    });
    const { displayedGarden, sceneVisible } = useGardenSceneTransition(
        gardenQuery.data,
    );
    const isSwitchingGarden =
        gardenQuery.isLoading || displayedGarden?.id !== activeGarden?.id;

    return (
        <section aria-labelledby="profile-gardens-heading">
            <h2
                id="profile-gardens-heading"
                className="mb-4 text-xl font-semibold"
            >
                Vrtovi
            </h2>
            {activeGarden ? (
                <>
                    <fieldset className="mb-4 flex min-w-0 flex-wrap gap-2">
                        <legend className="sr-only">Odaberi vrt</legend>
                        {gardens.map((garden) => (
                            <label
                                key={garden.id}
                                className="relative min-w-0 max-w-full cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="profile-garden"
                                    value={garden.id}
                                    checked={garden.id === activeGarden.id}
                                    onChange={() =>
                                        setSelectedGardenId(garden.id)
                                    }
                                    className="peer sr-only"
                                    aria-controls="profile-garden-preview"
                                />
                                <span className="flex min-h-11 items-center rounded-xl border-2 border-b-4 border-tertiary/60 bg-background px-4 py-2 font-medium break-words transition-colors hover:bg-tertiary/20 peer-checked:border-tertiary peer-checked:bg-tertiary/30 peer-checked:text-tertiary-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tertiary-foreground motion-reduce:transition-none">
                                    {garden.name}
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <section
                        id="profile-garden-preview"
                        aria-label={`Vrt: ${activeGarden.name}`}
                        aria-busy={!gardenQuery.error && isSwitchingGarden}
                        className="overflow-hidden rounded-2xl border border-tertiary"
                    >
                        <div className="relative h-[420px] sm:h-[520px]">
                            {gardenQuery.error ? (
                                <div
                                    role="alert"
                                    className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center"
                                >
                                    <p>Vrt trenutno nije dostupan.</p>
                                    <Button
                                        variant="outlined"
                                        onClick={() =>
                                            void gardenQuery.refetch()
                                        }
                                    >
                                        Pokušaj ponovno
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <GardenSceneTransitionSurface
                                        className="h-full"
                                        visible={
                                            sceneVisible &&
                                            !gardenQuery.isLoading
                                        }
                                    >
                                        {displayedGarden && (
                                            <PublicGardenViewerDynamic
                                                className="h-full"
                                                garden={displayedGarden}
                                            />
                                        )}
                                    </GardenSceneTransitionSurface>
                                    {isSwitchingGarden && (
                                        <div
                                            role="status"
                                            className="absolute inset-0 flex items-center justify-center gap-3 bg-background/40"
                                        >
                                            <Spinner loadingLabel="Učitavanje vrta" />
                                            <span>Učitavanje vrta...</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        {displayedGarden && !gardenQuery.error && (
                            <div className="bg-card" inert={isSwitchingGarden}>
                                <h3 className="px-4 py-4 text-lg font-semibold break-words sm:px-5">
                                    {displayedGarden.name}
                                </h3>
                                <PublicGardenSummary
                                    garden={displayedGarden}
                                    activePlantCount={countActivePlantsFromPublicGarden(
                                        displayedGarden,
                                    )}
                                />
                                {blockDataQuery.data && (
                                    <PublicGardenStatsAccordion
                                        stats={calculatePublicGardenStats(
                                            displayedGarden,
                                            blockDataQuery.data,
                                        )}
                                    />
                                )}
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Još nema javnih vrtova.
                </p>
            )}
        </section>
    );
}
