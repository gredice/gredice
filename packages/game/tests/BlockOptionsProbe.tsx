import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import { useThree } from '@react-three/fiber';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Box3, Mesh, OrthographicCamera, Vector3 } from 'three';
import {
    findBlockEditingTarget,
    getBlockEditingAnchor,
} from '../src/blockOptions/blockEditingTarget';
import { resolveBlockExpandStart } from '../src/blockOptions/expand/expansionPlanInput';
import { instancedBlockNames } from '../src/entities/EntityInstances';
import { useBlockData } from '../src/hooks/useBlockData';
import { useCurrentGarden } from '../src/hooks/useCurrentGarden';
import { useSceneRenderRequest } from '../src/scene/SceneTime';
import { useGameStateStore } from '../src/useGameState';
import {
    getBlockDataByName,
    getStackBlockHeight,
    getStackHeight,
} from '../src/utils/stackHeightCore';
import type {
    BlockOptionsProbeApi,
    BlockOptionsProbeBlock,
    BlockOptionsProbeCamera,
    BlockOptionsProbeOutline,
    BlockOptionsProbePoint,
    BlockOptionsProbeSnapshot,
} from './blockOptionsFixtureData';

const outlineTargetName = 'Interaction:HoverOutlineTarget';
const instancedBlockNameSet: ReadonlySet<string> = new Set(instancedBlockNames);

function cellKey(x: number, z: number) {
    return `${x}|${z}`;
}

/**
 * Installs `window.__blockOptionsProbe` for the block-options browser specs.
 * Mount it inside the fixture's Canvas. Everything is read on demand when a
 * spec asks; the probe adds no frame callback and no render lease.
 */
export function BlockOptionsProbe({
    entitiesRootName,
    gardenQueryKey,
    instancedRootName,
}: {
    /** Name of the group that holds the per-entity blocks. */
    entitiesRootName: string;
    /** The current garden's query key (`invalidateGarden`). */
    gardenQueryKey: QueryKey;
    /** Name of the group that holds `EntityInstances` (instanced outlines). */
    instancedRootName: string;
}) {
    const store = useGameStateStore();
    const queryClient = useQueryClient();
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const latestRef = useRef({ blockData, camera, garden });

    useLayoutEffect(() => {
        latestRef.current = { blockData, camera, garden };
    }, [blockData, camera, garden]);

    useEffect(() => {
        function projectWorld(
            x: number,
            y: number,
            z: number,
        ): BlockOptionsProbePoint | null {
            const canvas = gl.domElement;
            if (!canvas.isConnected) {
                return null;
            }

            const currentCamera = latestRef.current.camera;
            currentCamera.updateMatrixWorld();
            const projected = new Vector3(x, y, z).project(currentCamera);
            const rect = canvas.getBoundingClientRect();
            return {
                x: rect.left + ((projected.x + 1) / 2) * rect.width,
                y: rect.top + ((1 - projected.y) / 2) * rect.height,
            };
        }

        function blockScreenPosition(
            blockId: string,
            part: 'anchor' | 'center' | 'top' = 'center',
        ) {
            const { blockData: data, garden: currentGarden } =
                latestRef.current;
            const target = findBlockEditingTarget(currentGarden, blockId);
            if (!target || !data) {
                return null;
            }

            const [x, anchorY, z] = getBlockEditingAnchor(data, target);
            if (part === 'anchor') {
                return projectWorld(x, anchorY, z);
            }

            const baseHeight = getStackHeight(data, target.stack, target.block);
            const blockHeight = getStackBlockHeight(
                data,
                target.stack,
                target.block,
                target.blockIndex,
            );
            return projectWorld(
                x,
                part === 'top'
                    ? baseHeight + blockHeight
                    : baseHeight + blockHeight / 2,
                z,
            );
        }

        function readCamera(): BlockOptionsProbeCamera {
            const state = store.getState();
            const snapshot = state.gameCamera?.getSnapshot();
            const currentCamera = latestRef.current.camera;
            return {
                position: [
                    currentCamera.position.x,
                    currentCamera.position.y,
                    currentCamera.position.z,
                ],
                target: snapshot ? snapshot.target : null,
                zoom:
                    currentCamera instanceof OrthographicCamera
                        ? currentCamera.zoom
                        : (snapshot?.zoom ?? 0),
                placementLocked:
                    state.pickupBlock !== null ||
                    state.hudPlacementDrag !== null,
            };
        }

        function readOutline(): BlockOptionsProbeOutline {
            const instancedRoot = scene.getObjectByName(instancedRootName);
            const instancedCells: { x: number; z: number }[] = [];
            if (instancedRoot) {
                instancedRoot.updateWorldMatrix(true, true);
                instancedRoot.traverse((object) => {
                    if (object.name !== outlineTargetName) {
                        return;
                    }

                    const bounds = new Box3().setFromObject(object);
                    if (bounds.isEmpty()) {
                        return;
                    }

                    const center = bounds.getCenter(new Vector3());
                    instancedCells.push({
                        x: Math.round(center.x),
                        z: Math.round(center.z),
                    });
                });
            }
            instancedCells.sort((left, right) =>
                left.x === right.x ? left.z - right.z : left.x - right.x,
            );

            return {
                instancedCells,
                stationaryPickupBlockId:
                    store.getState().stationaryPickupOutlineTarget?.blockId ??
                    null,
            };
        }

        function readGarden(): BlockOptionsProbeSnapshot['garden'] {
            const currentGarden = latestRef.current.garden;
            if (!currentGarden) {
                return null;
            }

            const blocks: BlockOptionsProbeBlock[] = [];
            for (const stack of currentGarden.stacks) {
                stack.blocks.forEach((block, index) => {
                    blocks.push({
                        id: block.id,
                        name: block.name,
                        x: stack.position.x,
                        z: stack.position.z,
                        index,
                        rotation: block.rotation,
                    });
                });
            }

            return {
                id: currentGarden.id,
                isSandbox: currentGarden.isSandbox,
                blocks,
            };
        }

        function readEditingAnchor() {
            const editing = store.getState().blockEditing;
            return editing
                ? blockScreenPosition(editing.blockId, 'anchor')
                : null;
        }

        function readFrames() {
            return gl.info.render.frame;
        }

        function readPendingEntityBlockIds() {
            const currentGarden = latestRef.current.garden;
            if (!currentGarden) {
                return [];
            }

            const renderedCells = new Set<string>();
            const entitiesRoot = scene.getObjectByName(entitiesRootName);
            if (entitiesRoot) {
                entitiesRoot.updateWorldMatrix(true, true);
                entitiesRoot.traverse((object) => {
                    if (!(object instanceof Mesh)) {
                        return;
                    }

                    const bounds = new Box3().setFromObject(object);
                    if (!bounds.isEmpty()) {
                        const center = bounds.getCenter(new Vector3());
                        renderedCells.add(
                            cellKey(Math.round(center.x), Math.round(center.z)),
                        );
                    }
                });
            }

            // A block counts as drawn when a mesh centre lies on any cell of
            // its footprint (multi-cell models centre between cells).
            const data = latestRef.current.blockData;
            return currentGarden.stacks.flatMap((stack) =>
                stack.blocks
                    .filter((block) => {
                        if (instancedBlockNameSet.has(block.name)) {
                            return false;
                        }

                        const offsets = getGardenBlockFootprintOffsets(
                            data
                                ? getBlockDataByName(data, block.name)
                                : undefined,
                            block.rotation,
                        );
                        return !offsets.some((offset) =>
                            renderedCells.has(
                                cellKey(
                                    stack.position.x + offset.x,
                                    stack.position.z + offset.y,
                                ),
                            ),
                        );
                    })
                    .map((block) => block.id),
            );
        }

        function isReady() {
            const { blockData: data, garden: currentGarden } =
                latestRef.current;
            return (
                Boolean(data && currentGarden) &&
                readFrames() > 0 &&
                readPendingEntityBlockIds().length === 0
            );
        }

        function snapshot(): BlockOptionsProbeSnapshot {
            const state = store.getState();
            return {
                ready: isReady(),
                frames: readFrames(),
                pendingEntityBlockIds: readPendingEntityBlockIds(),
                blockEditing: state.blockEditing,
                camera: readCamera(),
                outline: readOutline(),
                pickupBlockId: state.pickupBlock?.id ?? null,
                hudPlacementDragActive: state.hudPlacementDrag !== null,
                hudObstacles: [...state.blockOptionsHudObstacles],
                editingAnchor: readEditingAnchor(),
                garden: readGarden(),
            };
        }

        function openBlockOptions(blockId: string, pointerType = 'mouse') {
            const target = findBlockEditingTarget(
                latestRef.current.garden,
                blockId,
            );
            if (!target) {
                return null;
            }

            store.getState().openBlockOptions({
                blockId,
                blockName: target.block.name,
                pointerType,
            });
            return store.getState().blockEditing;
        }

        const api: BlockOptionsProbeApi = {
            get ready() {
                return isReady();
            },
            get frames() {
                return readFrames();
            },
            get pendingEntityBlockIds() {
                return readPendingEntityBlockIds();
            },
            get blockEditing() {
                return store.getState().blockEditing;
            },
            get camera() {
                return readCamera();
            },
            get outline() {
                return readOutline();
            },
            get pickupBlockId() {
                return store.getState().pickupBlock?.id ?? null;
            },
            get hudPlacementDragActive() {
                return store.getState().hudPlacementDrag !== null;
            },
            get hudObstacles() {
                return [...store.getState().blockOptionsHudObstacles];
            },
            get editingAnchor() {
                return readEditingAnchor();
            },
            get garden() {
                return readGarden();
            },
            snapshot,
            openBlockOptions,
            startBlockExpand: (blockId) => {
                const editing = store.getState().blockEditing;
                if (editing?.mode !== 'menu' || editing.blockId !== blockId) {
                    openBlockOptions(blockId);
                }
                if (store.getState().blockEditing?.mode !== 'menu') {
                    return { ok: false, reason: 'menu-not-open' };
                }

                const start = resolveBlockExpandStart({
                    blockData: latestRef.current.blockData,
                    blockId,
                    garden: latestRef.current.garden,
                });
                if (!start.ok) {
                    return { ok: false, reason: start.reason };
                }

                store.getState().startBlockExpand(start.start);
                return store.getState().blockEditing?.mode === 'expand'
                    ? { ok: true }
                    : { ok: false, reason: 'not-started' };
            },
            setBlockExpandCorner: (x, z) =>
                store.getState().setBlockExpandCorner({ x, z }),
            requestBlockRemove: () => store.getState().requestBlockRemove(),
            closeBlockEditing: () => store.getState().closeBlockEditing(),
            projectWorld,
            blockScreenPosition,
            renderResources: () => ({
                programs: gl.info.programs?.length ?? 0,
                geometries: gl.info.memory.geometries,
                textures: gl.info.memory.textures,
            }),
            requestRender: () => {
                requestRender('block-options-probe');
            },
            renderResourceIds: () => {
                const geometries = new Set<number>();
                const materials = new Set<number>();
                scene.traverse((object) => {
                    if (
                        !object.name.startsWith('BlockExpand:') ||
                        !(object instanceof Mesh)
                    ) {
                        return;
                    }
                    geometries.add(object.geometry.id);
                    const { material } = object;
                    for (const entry of Array.isArray(material)
                        ? material
                        : [material]) {
                        materials.add(entry.id);
                    }
                });
                const byNumber = (left: number, right: number) => left - right;
                return {
                    programs: (gl.info.programs ?? [])
                        .map((program) => `${program.id}:${program.name}`)
                        .sort(),
                    expandGeometries: [...geometries].sort(byNumber),
                    expandMaterials: [...materials].sort(byNumber),
                };
            },
            countObjects: (prefix) => {
                let count = 0;
                scene.traverse((object) => {
                    if (object.name.startsWith(prefix)) {
                        count++;
                    }
                });
                return count;
            },
            invalidateGarden: () =>
                queryClient.invalidateQueries({
                    queryKey: gardenQueryKey,
                    exact: true,
                }),
        };

        window.__blockOptionsProbe = api;
        return () => {
            if (window.__blockOptionsProbe === api) {
                delete window.__blockOptionsProbe;
            }
        };
    }, [
        entitiesRootName,
        gardenQueryKey,
        gl,
        instancedRootName,
        queryClient,
        requestRender,
        scene,
        store,
    ]);

    return null;
}
