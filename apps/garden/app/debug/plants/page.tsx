import { PlantCatalogPerformanceViewerDynamic } from './PlantCatalogPerformanceViewerDynamic';
import { PlantPerformanceViewerDynamic } from './PlantPerformanceViewerDynamic';

export const instant = false;

type DebugPlantsSearchParams = Promise<{
    catalog?: string | string[];
    labels?: string | string[];
}>;

function isCatalogRequested(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.includes('1') : value === '1';
}

export default async function DebugPlantsPage({
    searchParams,
}: {
    searchParams: DebugPlantsSearchParams;
}) {
    const query = await searchParams;
    const catalogRequested = isCatalogRequested(query.catalog);
    const labelsRequested = isCatalogRequested(query.labels);

    return (
        <div
            className="flex h-screen w-screen flex-col bg-neutral-900"
            data-game-profile-comparison-contract-version={
                process.env.NEXT_PUBLIC_GAME_PROFILE_COMPARISON_CONTRACT_VERSION
            }
            data-game-profile-source-commit={
                process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_COMMIT
            }
            data-game-profile-source-dirty={
                process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_DIRTY
            }
        >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-700 p-4">
                <div>
                    <h1 className="text-xl font-bold text-white">
                        {catalogRequested
                            ? 'Plant Catalog Performance View'
                            : 'Plant Garden Debug View'}
                    </h1>
                    <p className="text-sm text-neutral-400">
                        {catalogRequested ? (
                            <>
                                One deterministic mature instance for every
                                developmental plant preset in a single Scene.
                                This exercises the direct PlantGenerator path.
                            </>
                        ) : (
                            <>
                                Normal game scene with a plant-heavy mock garden
                                of raised beds using developmental plant graph
                                generation.
                            </>
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {catalogRequested && (
                        <a
                            className="rounded border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
                            href={
                                labelsRequested
                                    ? '/debug/plants?catalog=1'
                                    : '/debug/plants?catalog=1&labels=1'
                            }
                        >
                            {labelsRequested ? 'Hide labels' : 'Show labels'}
                        </a>
                    )}
                    <a
                        className="rounded border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
                        href={
                            catalogRequested
                                ? '/debug/plants'
                                : '/debug/plants?catalog=1'
                        }
                    >
                        {catalogRequested
                            ? 'Heavy garden'
                            : 'All-plant catalog'}
                    </a>
                </div>
            </div>
            <div className="min-h-0 flex-1">
                {catalogRequested ? (
                    <PlantCatalogPerformanceViewerDynamic
                        showLabels={labelsRequested}
                    />
                ) : (
                    <PlantPerformanceViewerDynamic />
                )}
            </div>
        </div>
    );
}
