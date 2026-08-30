'use client';

import {
    createGardenStructureTemplateSeed,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxSideLength,
    getGardenStructureDocumentPrice,
    getGardenStructureFootprintBounds,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useRef } from 'react';
import {
    type GardenStructureBuildCategory,
    type GardenStructureBuildSession,
    useGameState,
} from '../useGameState';
import { getGardenStructureSelectablePartIds } from './gardenStructureSelectableParts';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

const templateOptions: readonly {
    key: GardenStructureTemplateKey;
    label: string;
}[] = [
    { key: 'barn', label: 'Štala' },
    { key: 'house', label: 'Kuća' },
    { key: 'greenhouse', label: 'Staklenik' },
    { key: 'blank', label: 'Prazno' },
];

const categoryOptions: readonly {
    key: GardenStructureBuildCategory;
    label: string;
}[] = [
    { key: 'footprint', label: 'Tlocrt' },
    { key: 'structure', label: 'Konstrukcija' },
    { key: 'roof', label: 'Krov' },
    { key: 'interior', label: 'Interijer' },
];

const controlClassName =
    'pointer-events-auto min-h-11 min-w-11 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-45';

function startFixtureSession(
    templateKey: GardenStructureTemplateKey,
): GardenStructureBuildSession {
    return {
        phase: 'editing',
        source: 'fixture',
        templateKey,
        rotation: 0,
        category: 'structure',
        roofCutaway: false,
        selectedPartId: null,
    };
}

function nextRotation(
    rotation: GardenStructureRotation,
): GardenStructureRotation {
    switch (rotation) {
        case 0:
            return 1;
        case 1:
            return 2;
        case 2:
            return 3;
        case 3:
            return 0;
    }
}

export function GardenStructureVerticalSliceHud({
    plan,
}: {
    plan?: GardenStructureSemanticPlan;
}) {
    const session = useGameState((state) => state.structureBuildSession);
    const setSession = useGameState((state) => state.setStructureBuildSession);
    const doneButtonRef = useRef<HTMLButtonElement>(null);
    const buildActive = Boolean(session);
    const templateKey = session?.templateKey;
    const seed = useMemo(
        () =>
            templateKey ? createGardenStructureTemplateSeed(templateKey) : null,
        [templateKey],
    );
    const bounds = seed
        ? getGardenStructureFootprintBounds(seed.document.footprint.cells)
        : null;
    const price = seed ? getGardenStructureDocumentPrice(seed.document) : 0;
    const selectablePartIds = useMemo(
        () =>
            plan && session
                ? getGardenStructureSelectablePartIds(plan, session.category)
                : [],
        [plan, session],
    );

    useEffect(() => {
        if (!buildActive) {
            return;
        }
        doneButtonRef.current?.focus({ preventScroll: true });
        const timeout = window.setTimeout(
            () => doneButtonRef.current?.focus({ preventScroll: true }),
            0,
        );
        return () => window.clearTimeout(timeout);
    }, [buildActive]);

    useEffect(() => {
        if (!session) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            setSession(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session, setSession]);
    if (!session || !seed || !bounds) {
        return (
            <div className="pointer-events-none absolute inset-0 z-30">
                <button
                    type="button"
                    className={cx(
                        controlClassName,
                        'absolute right-[calc(var(--game-safe-area-right,0px)+0.75rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)] border-amber-500/70 bg-amber-50/95 text-amber-950 dark:bg-amber-950/90 dark:text-amber-50',
                    )}
                    data-testid="garden-structure-build-entry"
                    onClick={() => setSession(startFixtureSession('house'))}
                >
                    Gradnja
                </button>
            </div>
        );
    }

    const updateSession = (
        updates: Partial<
            Pick<
                GardenStructureBuildSession,
                | 'category'
                | 'roofCutaway'
                | 'rotation'
                | 'selectedPartId'
                | 'templateKey'
            >
        >,
    ) => setSession({ ...session, ...updates });
    const templateLabel =
        templateOptions.find((option) => option.key === session.templateKey)
            ?.label ?? session.templateKey;

    return (
        <section
            aria-label="Prototip načina gradnje"
            className="pointer-events-none absolute inset-0 z-40 select-none"
            data-structure-build-mode="editing"
            data-testid="garden-structure-build-hud"
        >
            <header className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex items-center justify-between gap-2">
                <div className="pointer-events-auto rounded-xl border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md">
                    <p className="text-sm font-semibold text-foreground">
                        {templateLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Prototip · ne sprema se
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className={controlClassName}
                        disabled
                        aria-label="Poništi posljednju promjenu"
                    >
                        ↶
                    </button>
                    <button
                        type="button"
                        className={controlClassName}
                        disabled
                        aria-label="Ponovi posljednju promjenu"
                    >
                        ↷
                    </button>
                    <button
                        type="button"
                        className={cx(
                            controlClassName,
                            'border-green-600 bg-green-600 text-white hover:bg-green-700',
                        )}
                        data-testid="garden-structure-build-done"
                        onClick={() => setSession(null)}
                        ref={doneButtonRef}
                    >
                        Gotovo
                    </button>
                </div>
            </header>

            <div
                className="pointer-events-auto absolute right-[calc(var(--game-safe-area-right,0px)+0.5rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] mx-auto max-h-[min(46dvh,22rem)] w-auto max-w-2xl overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-lg landscape:right-auto landscape:max-h-[calc(100dvh-var(--game-safe-area-top,0px)-var(--game-safe-area-bottom,0px)-5rem)] landscape:max-w-sm md:right-auto md:max-w-sm"
                data-testid="garden-structure-build-sheet"
            >
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2 text-xs text-foreground">
                    <span>
                        {seed.document.footprint.cells.length} /{' '}
                        {gardenStructureMaxFootprintCells} polja
                    </span>
                    <span>
                        {bounds.width} × {bounds.depth} /{' '}
                        {gardenStructureMaxSideLength}
                    </span>
                    <span className="font-semibold">
                        {price.toLocaleString('hr-HR')} 🌻
                    </span>
                </div>

                <fieldset className="mb-3">
                    <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                        Predložak
                    </legend>
                    <div className="grid grid-cols-4 gap-1.5">
                        {templateOptions.map((option) => (
                            <button
                                type="button"
                                className={cx(
                                    controlClassName,
                                    'px-2 text-xs',
                                    option.key === session.templateKey &&
                                        'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
                                )}
                                aria-pressed={
                                    option.key === session.templateKey
                                }
                                key={option.key}
                                onClick={() =>
                                    updateSession({
                                        templateKey: option.key,
                                        selectedPartId: null,
                                    })
                                }
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                        Alat
                    </legend>
                    <div className="grid grid-cols-4 gap-1.5">
                        {categoryOptions.map((option) => (
                            <button
                                type="button"
                                className={cx(
                                    controlClassName,
                                    'px-2 text-xs',
                                    option.key === session.category &&
                                        'border-green-600 bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-50',
                                )}
                                aria-pressed={option.key === session.category}
                                key={option.key}
                                onClick={() =>
                                    updateSession({
                                        category: option.key,
                                        selectedPartId: null,
                                    })
                                }
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        className={controlClassName}
                        onClick={() =>
                            updateSession({
                                rotation: nextRotation(session.rotation),
                            })
                        }
                    >
                        Zakreni 90°
                    </button>
                    <button
                        type="button"
                        aria-pressed={session.roofCutaway}
                        className={controlClassName}
                        onClick={() =>
                            updateSession({
                                roofCutaway: !session.roofCutaway,
                            })
                        }
                    >
                        {session.roofCutaway ? 'Prikaži krov' : 'Sakrij krov'}
                    </button>
                </div>
                <label className="mt-3 block text-xs font-semibold text-muted-foreground">
                    Odabrani dio
                    <select
                        className="mt-1 min-h-11 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        data-testid="garden-structure-part-select"
                        onChange={(event) =>
                            updateSession({
                                selectedPartId:
                                    event.currentTarget.value || null,
                            })
                        }
                        value={session.selectedPartId ?? ''}
                    >
                        <option value="">Nije odabrano</option>
                        {selectablePartIds.map((partId) => (
                            <option key={partId} value={partId}>
                                {partId}
                            </option>
                        ))}
                    </select>
                </label>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                    {session.selectedPartId
                        ? `Odabrano: ${session.selectedPartId}`
                        : 'Dodirnite dio građevine za odabir.'}
                </p>
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {templateLabel}, {seed.document.footprint.cells.length} polja,
                cijena {price.toLocaleString('hr-HR')} suncokreta, kategorija{' '}
                {session.category}.
                {session.selectedPartId
                    ? ` Odabrano ${session.selectedPartId}.`
                    : ''}
            </p>
        </section>
    );
}
