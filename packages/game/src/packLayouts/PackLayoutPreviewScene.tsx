import { useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useOwnedPackLayouts } from '../hooks/useOwnedPackLayouts';
import { useSceneRenderRequest } from '../scene/SceneTime';
import { useGameState, useGameStateStore } from '../useGameState';
import { getStackHeight } from '../utils/stackHeightCore';
import { PackLayoutRenderBoundary } from './PackLayoutRenderBoundary';
import { resolveOwnedPackLayout } from './packLayoutProjection';
import { TranslucentPackLayoutItem } from './TranslucentPackLayoutItem';

const ground = new Plane(new Vector3(0, 1, 0), 0);
export function PackLayoutPreviewScene() {
    const selection = useGameState((state) => state.packLayoutPreview);
    const locked = useGameState((state) => state.packLayoutPreviewLocked);
    const store = useGameStateStore();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const layouts = useOwnedPackLayouts(selection?.pack.purchaseId);
    const layout = layouts.data?.layouts.find(
        (item) => item.id === selection?.layoutId,
    );
    const camera = useThree((state) => state.camera);
    const canvas = useThree((state) => state.gl.domElement);
    const render = useSceneRenderRequest();
    const preview = useMemo(
        () =>
            selection && garden && layout
                ? resolveOwnedPackLayout({
                      layout,
                      pack: selection.pack,
                      blockData,
                      garden,
                      anchor: selection.anchor,
                      rotation: selection.rotation,
                  })
                : null,
        [selection, garden, layout, blockData],
    );
    const identity = selection
        ? `${selection.key}:${selection.anchor.x}:${selection.anchor.y}:${selection.rotation}`
        : '';
    const readiness = useMemo(
        () => ({ identity, ready: new Set<string>() }),
        [identity],
    );
    const onReady = useCallback(
        (id: string, value: boolean) => {
            const current = store.getState().packLayoutPreview;
            if (
                !current ||
                `${current.key}:${current.anchor.x}:${current.anchor.y}:${current.rotation}` !==
                    identity
            )
                return;
            if (value) readiness.ready.add(id);
            else readiness.ready.delete(id);
            store
                .getState()
                .setPackLayoutPreviewReady(
                    Boolean(
                        preview?.valid &&
                            readiness.ready.size === preview.placements.length,
                    ),
                );
            render('pack-layout-model-ready');
        },
        [identity, readiness, preview, store, render],
    );
    const unavailable = useCallback(() => {
        const current = store.getState().packLayoutPreview;
        if (
            !current ||
            `${current.key}:${current.anchor.x}:${current.anchor.y}:${current.rotation}` !==
                identity
        )
            return;
        store.getState().setPackLayoutPreviewReady(false);
        store.getState().setPackLayoutPreviewUnavailable(true);
    }, [store, identity]);
    useEffect(() => {
        if (identity) store.getState().setPackLayoutPreviewUnavailable(false);
    }, [identity, store]);
    const selectionKey = selection?.key;
    const down = useRef<{ x: number; y: number; pointerId: number } | null>(
        null,
    );
    useEffect(() => {
        if (!selectionKey || locked) return;
        const pointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || !event.isPrimary) return;
            down.current = {
                x: event.clientX,
                y: event.clientY,
                pointerId: event.pointerId,
            };
            event.stopImmediatePropagation();
        };
        const pointerUp = (event: PointerEvent) => {
            const start = down.current;
            down.current = null;
            event.stopImmediatePropagation();
            if (
                !start ||
                start.pointerId !== event.pointerId ||
                Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8
            )
                return;
            const rect = canvas.getBoundingClientRect();
            const ray = new Raycaster();
            ray.setFromCamera(
                new Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    1 - ((event.clientY - rect.top) / rect.height) * 2,
                ),
                camera,
            );
            const point = ray.ray.intersectPlane(ground, new Vector3());
            if (!point) return;
            const current = store.getState().packLayoutPreview;
            if (!current || current.key !== selectionKey) return;
            store.getState().setPackLayoutPreviewReady(false);
            store.getState().setPackLayoutPreview({
                ...current,
                anchor: { x: Math.round(point.x), y: Math.round(point.z) },
            });
            render('pack-layout-move');
        };
        const cancel = () => {
            down.current = null;
        };
        canvas.addEventListener('pointerdown', pointerDown, true);
        canvas.addEventListener('pointerup', pointerUp, true);
        canvas.addEventListener('pointercancel', cancel, true);
        return () => {
            canvas.removeEventListener('pointerdown', pointerDown, true);
            canvas.removeEventListener('pointerup', pointerUp, true);
            canvas.removeEventListener('pointercancel', cancel, true);
            down.current = null;
        };
    }, [selectionKey, locked, camera, canvas, render, store]);
    useEffect(() => {
        render(`pack-layout-preview:${identity}:${preview?.valid}:${locked}`);
    }, [identity, preview, locked, render]);
    if (
        !selection ||
        !preview ||
        !layouts.context.eligible ||
        selection.gardenId !== garden?.id ||
        selection.accountId !== layouts.context.accountId ||
        selection.userId !== layouts.context.userId
    )
        return null;
    return (
        <group
            name="Interaction:PackLayoutPreview"
            userData={{
                valid: preview.valid,
                rotation: selection.rotation,
                anchor: selection.anchor,
                quantity: preview.placements.length,
            }}
        >
            {preview.placements.map((item) => {
                const cells = Array.from(
                    { length: item.footprint.width * item.footprint.depth },
                    (_, index) => ({
                        x: item.position.x + (index % item.footprint.width),
                        y:
                            item.position.y +
                            Math.floor(index / item.footprint.width),
                    }),
                );
                const block = {
                    id: `${identity}:${item.slotId}`,
                    name: item.modelName,
                    rotation: item.rotation,
                    ...(item.variant === null ? {} : { variant: item.variant }),
                };
                const stack = {
                    position: new Vector3(item.position.x, 0, item.position.y),
                    blocks: [...item.baseBlocks, block],
                };
                return (
                    <group key={block.id}>
                        <PackLayoutRenderBoundary onUnavailable={unavailable}>
                            <Suspense fallback={null}>
                                <TranslucentPackLayoutItem
                                    block={block}
                                    stack={stack}
                                    onReady={onReady}
                                />
                            </Suspense>
                        </PackLayoutRenderBoundary>
                        {cells.map((cell) => (
                            <mesh
                                key={`${block.id}:cell:${cell.x}:${cell.y}`}
                                name="PackLayout:Cell"
                                position={[
                                    cell.x,
                                    getStackHeight(
                                        blockData ?? [],
                                        garden?.stacks.find(
                                            (support) =>
                                                support.position.x === cell.x &&
                                                support.position.z === cell.y,
                                        ),
                                    ) + 0.02,
                                    cell.y,
                                ]}
                                rotation-x={-Math.PI / 2}
                                raycast={() => {}}
                            >
                                <planeGeometry args={[0.9, 0.9]} />
                                <meshBasicMaterial
                                    color={
                                        preview.valid ? '#4ade80' : '#ef4444'
                                    }
                                    transparent
                                    opacity={0.35}
                                    depthWrite={false}
                                />
                            </mesh>
                        ))}
                    </group>
                );
            })}
        </group>
    );
}
