'use client';

import type { PublicGardenResponse } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Stack as UiStack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { OrbitControls } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from '../entities/EntityInstances';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useDeferredSceneDetails } from '../hooks/useDeferredSceneDetails';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';

export type PublicGardenBlock = Block;

export type PublicGardenStack = {
    x: number;
    y: number;
    blocks: PublicGardenBlock[];
};

export type PublicGardenDetail = PublicGardenResponse;

export type PublicGardenViewerProps = HTMLAttributes<HTMLDivElement> & {
    garden?: PublicGardenDetail;
    stacks?: PublicGardenStack[];
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    deferDetails?: boolean;
    className?: string;
};

function normalizeStacks(stacks: PublicGardenStack[]): Stack[] {
    return stacks.map((stack) => ({
        position: new Vector3(stack.x, stack.y, 0),
        blocks: stack.blocks,
    }));
}

export function publicGardenStacksFromResponse(
    stacks: PublicGardenDetail['stacks'],
): PublicGardenStack[] {
    return Object.entries(stacks).flatMap(([x, rows]) =>
        Object.entries(rows).map(([y, blocks]) => ({
            x: Number(x),
            y: Number(y),
            blocks: blocks.map((block) => ({
                id: block.id,
                name: block.name,
                rotation: block.rotation ?? 0,
                variant: block.variant,
            })),
        })),
    );
}

function formatDate(value: string | Date | null | undefined) {
    if (!value) {
        return null;
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value));
}

function statusLabel(status: string | null | undefined) {
    if (!status) {
        return 'Bez statusa';
    }

    return status;
}

function PublicGardenDetailsPanel({ garden }: { garden: PublicGardenDetail }) {
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        number | null
    >(garden.raisedBeds[0]?.id ?? null);
    const selectedRaisedBed =
        garden.raisedBeds.find(
            (raisedBed) => raisedBed.id === selectedRaisedBedId,
        ) ??
        garden.raisedBeds[0] ??
        null;
    const plantedFields =
        selectedRaisedBed?.fields.filter(
            (field) =>
                typeof field.plantSortId === 'number' && field.active !== false,
        ) ?? [];

    return (
        <aside className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[45%] overflow-auto rounded-md border border-black/10 bg-background/95 p-3 shadow-lg backdrop-blur md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-80">
            <UiStack spacing={4}>
                <UiStack spacing={1}>
                    <Typography level="body1" semiBold>
                        {garden.name}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {garden.raisedBeds.length.toString()} gredica ·{' '}
                        {garden.queuedTasks.length.toString()} aktivnih radnji
                    </Typography>
                </UiStack>

                {garden.raisedBeds.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
                        {garden.raisedBeds.map((raisedBed) => (
                            <Button
                                key={raisedBed.id}
                                type="button"
                                size="xs"
                                variant={
                                    raisedBed.id === selectedRaisedBed?.id
                                        ? 'solid'
                                        : 'outlined'
                                }
                                onClick={() =>
                                    setSelectedRaisedBedId(raisedBed.id)
                                }
                            >
                                {raisedBed.name}
                            </Button>
                        ))}
                    </div>
                ) : null}

                {selectedRaisedBed ? (
                    <UiStack spacing={2}>
                        <Typography level="body2" semiBold>
                            {selectedRaisedBed.name}
                        </Typography>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd>{statusLabel(selectedRaisedBed.status)}</dd>
                            <dt className="text-muted-foreground">Biljke</dt>
                            <dd>{plantedFields.length.toString()}</dd>
                            <dt className="text-muted-foreground">Ažurirano</dt>
                            <dd>{formatDate(selectedRaisedBed.updatedAt)}</dd>
                        </dl>
                        <div className="space-y-1">
                            {plantedFields.length > 0 ? (
                                plantedFields.slice(0, 12).map((field) => (
                                    <p
                                        key={field.id}
                                        className="rounded-sm bg-muted/60 px-2 py-1 text-xs"
                                    >
                                        Polje{' '}
                                        {(field.positionIndex + 1).toString()} ·
                                        sorta #{field.plantSortId?.toString()} ·{' '}
                                        {statusLabel(field.plantStatus)}
                                    </p>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nema posađenih biljaka.
                                </p>
                            )}
                        </div>
                    </UiStack>
                ) : null}

                <UiStack spacing={2}>
                    <Typography level="body2" semiBold>
                        Planirane radnje
                    </Typography>
                    {garden.queuedTasks.length > 0 ? (
                        garden.queuedTasks.slice(0, 6).map((task) => (
                            <div
                                key={task.id}
                                className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
                            >
                                <div className="font-medium">
                                    {task.targetLabel}
                                </div>
                                <div className="text-muted-foreground">
                                    {statusLabel(task.status)}
                                    {task.scheduledDate
                                        ? ` · ${formatDate(task.scheduledDate)}`
                                        : ''}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Nema aktivnih radnji.
                        </p>
                    )}
                </UiStack>
            </UiStack>
        </aside>
    );
}

export function PublicGardenViewer({
    appBaseUrl,
    spriteBaseUrl,
    deferDetails = true,
    garden,
    stacks,
    className,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl || 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    const clientRef = useRef<QueryClient>(null);
    if (!clientRef.current) {
        clientRef.current = new QueryClient();
    }
    const publicStacks = useMemo(
        () =>
            garden
                ? publicGardenStacksFromResponse(garden.stacks)
                : (stacks ?? []),
        [garden, stacks],
    );
    const normalizedStacks = useMemo(
        () => normalizeStacks(publicStacks),
        [publicStacks],
    );
    const renderDetails = useDeferredSceneDetails(deferDetails);

    return (
        <QueryClientProvider client={clientRef.current}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameSceneDetailContext.Provider value={{ renderDetails }}>
                    <div className={cx('relative h-full w-full', className)}>
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={90}
                            className="h-full w-full"
                        >
                            <color attach="background" args={['#d9f2dc']} />
                            <ambientLight intensity={2} />
                            <hemisphereLight intensity={3} />
                            <directionalLight
                                position={[5, 20, 10]}
                                intensity={2.8}
                            />
                            <group>
                                {normalizedStacks.map((stack) =>
                                    stack.blocks.map((block) => (
                                        <EntityFactory
                                            key={`${stack.position.x}|${stack.position.y}|${block.id}-${block.name}`}
                                            name={block.name}
                                            stack={stack}
                                            block={block}
                                            stacks={normalizedStacks}
                                            rotation={block.rotation}
                                            variant={block.variant}
                                            noRenderInView={instancedBlockNames}
                                            noControl
                                        />
                                    )),
                                )}
                                <EntityInstances
                                    stacks={normalizedStacks}
                                    renderDetails={renderDetails}
                                />
                            </group>
                            <OrbitControls
                                enableRotate={false}
                                screenSpacePanning={false}
                                enablePan
                                minZoom={50}
                                maxZoom={500}
                            />
                        </Scene>
                        {garden ? (
                            <PublicGardenDetailsPanel garden={garden} />
                        ) : null}
                    </div>
                </GameSceneDetailContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
