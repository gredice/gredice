'use client';

import { Button } from '@gredice/ui/Button';
import {
    ExpandDown,
    Hammer,
    Joystick,
    Left,
    Navigate,
} from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
    createGardenStructureOverview2DSummaries,
    type GardenStructureOverview2DSummary,
    getGardenStructureOverview3DHref,
} from './gardenStructureOverview2D';
import type { CurrentGarden } from './hooks/useCurrentGarden';

const cellSize = 10;
const structureSummaryPageSize = 8;

function GardenStructureOverview2DFootprint({
    summary,
}: {
    summary: GardenStructureOverview2DSummary;
}) {
    const description = `${summary.width.toString()} × ${summary.depth.toString()}, ${summary.footprintCellCount.toString()} polja: ${summary.interiorCellCount.toString()} unutarnjih, ${summary.coveredOutdoorCellCount.toString()} natkrivenih vanjskih, ${summary.roofedCellCount.toString()} pod krovom.`;
    const topologyDescription = summary.cells
        .map((cell) => {
            const space =
                cell.spaceKind === 'interior'
                    ? 'unutarnje'
                    : 'natkriveno vanjsko';
            return `(${cell.x.toString()}, ${cell.y.toString()}) ${space}, ${cell.roofed ? 's krovom' : 'bez krova'}, ${cell.hasFloor ? 's podom' : 'bez poda'}`;
        })
        .join('; ');

    return (
        <svg
            role="img"
            aria-label={`Tlocrt za ${summary.label}, početni predložak ${summary.templateLabel}. ${description} Zauzeta polja: ${topologyDescription}.`}
            className="size-20 shrink-0 overflow-visible rounded-lg bg-green-950/5 p-1 dark:bg-white/5"
            preserveAspectRatio="xMidYMid meet"
            viewBox={`0 0 ${(summary.width * cellSize).toString()} ${(summary.depth * cellSize).toString()}`}
        >
            {summary.cells.map((cell) => (
                <g
                    key={`${cell.x.toString()}:${cell.y.toString()}`}
                    data-space-kind={cell.spaceKind}
                    data-roofed={cell.roofed ? 'true' : 'false'}
                    data-world-x={cell.worldX}
                    data-world-y={cell.worldY}
                >
                    <rect
                        x={cell.x * cellSize + 0.5}
                        y={cell.y * cellSize + 0.5}
                        width={cellSize - 1}
                        height={cellSize - 1}
                        rx={1.25}
                        className={cx(
                            'stroke-[0.8]',
                            cell.spaceKind === 'interior'
                                ? 'fill-amber-200 stroke-amber-800 dark:fill-amber-800 dark:stroke-amber-200'
                                : 'fill-sky-100 stroke-sky-700 [stroke-dasharray:2_1] dark:fill-sky-900 dark:stroke-sky-200',
                        )}
                    />
                    {cell.roofed ? (
                        <rect
                            x={cell.x * cellSize + 2.25}
                            y={cell.y * cellSize + 2.25}
                            width={cellSize - 4.5}
                            height={cellSize - 4.5}
                            rx={1}
                            className="fill-lime-600/45 dark:fill-lime-300/45"
                        />
                    ) : null}
                </g>
            ))}
        </svg>
    );
}

function GardenStructureOverview2DCard({
    href,
    summary,
}: {
    href: string;
    summary: GardenStructureOverview2DSummary;
}) {
    return (
        <article
            aria-label={`${summary.label}, početni predložak ${summary.templateLabel}, identifikator ${summary.id}`}
            data-garden-structure-id={summary.id}
            className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-green-950/10 bg-white/65 p-2.5 dark:border-lime-100/10 dark:bg-emerald-950/60"
        >
            <GardenStructureOverview2DFootprint summary={summary} />
            <div className="min-w-0 self-center">
                <h3 className="truncate text-sm font-bold text-green-950 dark:text-lime-50">
                    {summary.label}
                </h3>
                <p className="truncate text-xs text-green-950/75 dark:text-lime-50/75">
                    Početni predložak: {summary.templateLabel}
                </p>
                <code
                    className="block truncate text-[0.65rem] text-green-950/55 dark:text-lime-50/55"
                    dir="ltr"
                    title={summary.id}
                >
                    {summary.id}
                </code>
                <p className="mt-1 text-xs leading-snug text-green-950/75 dark:text-lime-50/75">
                    {summary.width} × {summary.depth} ·{' '}
                    {summary.footprintCellCount} polja
                </p>
                <p className="text-xs leading-snug text-green-950/75 dark:text-lime-50/75">
                    {summary.interiorCellCount} unutarnjih ·{' '}
                    {summary.coveredOutdoorCellCount} natkrivenih vanjskih
                </p>
                <p className="text-xs leading-snug text-green-950/75 dark:text-lime-50/75">
                    Krov {summary.roofedCellCount}/{summary.footprintCellCount}
                </p>
                <Button
                    aria-label={`Prikaži građevinu ${summary.id} u 3D prikazu`}
                    className="mt-2 min-h-11"
                    fullWidth
                    href={href}
                    size="sm"
                    variant="soft"
                >
                    Prikaži u 3D
                </Button>
            </div>
        </article>
    );
}

export function GardenStructureOverview2DPanel({
    structures,
}: {
    structures: CurrentGarden['structures'];
}) {
    const searchParams = useSearchParams();
    const [requestedPageIndex, setRequestedPageIndex] = useState(0);
    const summaries = useMemo(
        () => createGardenStructureOverview2DSummaries(structures),
        [structures],
    );
    const pageCount = Math.max(
        1,
        Math.ceil(summaries.length / structureSummaryPageSize),
    );
    const pageIndex = Math.min(requestedPageIndex, pageCount - 1);
    const visibleSummaries = summaries.slice(
        pageIndex * structureSummaryPageSize,
        (pageIndex + 1) * structureSummaryPageSize,
    );
    const threeDimensionalHref = getGardenStructureOverview3DHref(
        searchParams.entries(),
    );
    if (summaries.length === 0) {
        return null;
    }

    return (
        <aside
            aria-label="Građevine u vrtu"
            className="pointer-events-none absolute top-[calc(var(--game-safe-area-top,0px)+4.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] z-30 w-[min(22rem,calc(100%-var(--game-safe-area-left,0px)-var(--game-safe-area-right,0px)-1rem))]"
        >
            <details className="group pointer-events-auto">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-green-950/15 bg-lime-50/90 px-3 py-2 text-green-950 shadow-xl ring-1 ring-white/60 backdrop-blur-md [&::-webkit-details-marker]:hidden dark:border-lime-100/15 dark:bg-emerald-950/90 dark:text-lime-50 dark:ring-lime-100/10">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold">
                        <Hammer
                            aria-hidden="true"
                            className="size-4 shrink-0"
                        />
                        <span className="truncate">
                            Gradnja · Građevine ({summaries.length})
                        </span>
                    </span>
                    <ExpandDown
                        aria-hidden="true"
                        className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                </summary>
                <div className="mt-2 max-h-[min(52dvh,30rem)] overflow-y-auto overscroll-contain rounded-2xl border border-green-950/15 bg-lime-50/90 p-3 shadow-xl ring-1 ring-white/60 backdrop-blur-md dark:border-lime-100/15 dark:bg-emerald-950/90 dark:ring-lime-100/10">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="text-sm font-bold text-green-950 dark:text-lime-50">
                            Tlocrt građevina
                        </h2>
                        <span
                            aria-live="polite"
                            className="text-[0.65rem] text-green-950/65 dark:text-lime-50/65"
                        >
                            {pageIndex + 1}/{pageCount}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {visibleSummaries.map((summary) => (
                            <GardenStructureOverview2DCard
                                href={getGardenStructureOverview3DHref(
                                    searchParams.entries(),
                                    summary.id,
                                )}
                                key={summary.id}
                                summary={summary}
                            />
                        ))}
                    </div>
                    {pageCount > 1 ? (
                        <nav
                            aria-label="Stranice popisa građevina"
                            className="mt-2 grid grid-cols-2 gap-2"
                        >
                            <Button
                                aria-label="Prethodna stranica građevina"
                                className="min-h-11"
                                disabled={pageIndex === 0}
                                onClick={() =>
                                    setRequestedPageIndex(
                                        Math.max(0, pageIndex - 1),
                                    )
                                }
                                startDecorator={<Left className="size-4" />}
                                variant="soft"
                            >
                                Prethodne
                            </Button>
                            <Button
                                aria-label="Sljedeća stranica građevina"
                                className="min-h-11"
                                disabled={pageIndex === pageCount - 1}
                                endDecorator={<Navigate className="size-4" />}
                                onClick={() =>
                                    setRequestedPageIndex(
                                        Math.min(pageCount - 1, pageIndex + 1),
                                    )
                                }
                                variant="soft"
                            >
                                Sljedeće
                            </Button>
                        </nav>
                    ) : null}
                    <fieldset className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-green-950/70 dark:text-lime-50/70">
                        <legend className="sr-only">
                            Legenda tlocrta građevine
                        </legend>
                        <span className="inline-flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-2.5 rounded-sm border border-amber-800 bg-amber-200 dark:border-amber-200 dark:bg-amber-800"
                            />
                            Unutarnje
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-2.5 rounded-sm border border-dashed border-sky-700 bg-sky-100 dark:border-sky-200 dark:bg-sky-900"
                            />
                            Natkriveno vanjsko
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-2.5 rounded-sm bg-lime-600/45 ring-1 ring-lime-700/50 dark:bg-lime-300/45"
                            />
                            Krov
                        </span>
                    </fieldset>
                    <Button
                        aria-label="Prebaci na 3D prikaz vrta"
                        className="mt-3 min-h-11"
                        fullWidth
                        href={threeDimensionalHref}
                        startDecorator={<Joystick className="size-4" />}
                        variant="soft"
                    >
                        Prebaci na 3D
                    </Button>
                </div>
            </details>
        </aside>
    );
}
