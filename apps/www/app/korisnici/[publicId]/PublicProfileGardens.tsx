'use client';

import { clientPublic, directoriesClient } from '@gredice/client';
import {
    GardenSceneTransitionSurface,
    useGardenSceneTransition,
} from '@gredice/game/garden-scene-transition';
import { Button } from '@gredice/ui/Button';
import { GameGardenIcon } from '@gredice/ui/GameIcons';
import { Spinner } from '@gredice/ui/Spinner';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PublicEmptyState } from '../../../components/shared/placeholders/PublicEmptyState';
import { KnownPages } from '../../../src/KnownPages';
import { PublicGardenStatsAccordion } from '../../vrtovi/PublicGardenStatsAccordion';
import { PublicGardenSummary } from '../../vrtovi/PublicGardenSummary';
import {
    calculatePublicGardenStats,
    countActivePlantsFromPublicGarden,
} from '../../vrtovi/publicGardenFormatting';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';
import type { PublicProfileData } from './publicProfileData';

export function PublicProfileGardens({
    gardens,
}: Pick<PublicProfileData, 'gardens'>) {
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
                className="mb-5 text-2xl font-semibold"
            >
                Vrtovi
            </h2>
            {activeGarden ? (
                <>
                    {/* One garden needs no choice; the preview names it. */}
                    {gardens.length > 1 && (
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
                                    <span className="flex min-h-11 items-center gap-2 rounded-full border border-tertiary/60 bg-card px-4 py-2 font-medium break-words transition-colors hover:bg-tertiary/20 peer-checked:border-tertiary peer-checked:bg-tertiary/30 peer-checked:text-tertiary-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tertiary-foreground motion-reduce:transition-none">
                                        <GameGardenIcon
                                            aria-hidden
                                            className="size-6 shrink-0"
                                        />
                                        {garden.name}
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    )}
                    <section
                        id="profile-garden-preview"
                        aria-label={`Vrt: ${activeGarden.name}`}
                        aria-busy={!gardenQuery.error && isSwitchingGarden}
                        className="overflow-hidden rounded-3xl border border-b-4 border-tertiary bg-card"
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
                            <div
                                className="border-t bg-card"
                                inert={isSwitchingGarden}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                                    <h3 className="min-w-0 text-lg font-semibold break-words">
                                        {displayedGarden.name}
                                    </h3>
                                    <Button
                                        href={KnownPages.PublicGarden(
                                            displayedGarden.id,
                                        )}
                                        variant="outlined"
                                        size="sm"
                                    >
                                        Posjeti vrt
                                    </Button>
                                </div>
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
                <PublicEmptyState
                    icon={GameGardenIcon}
                    className="rounded-2xl border border-dashed py-10"
                >
                    Još nema javnih vrtova.
                </PublicEmptyState>
            )}
        </section>
    );
}
