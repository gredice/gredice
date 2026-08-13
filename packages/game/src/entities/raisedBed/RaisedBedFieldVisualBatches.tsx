'use client';

import { calculatePlantsPerField } from '@gredice/js/plants';
import { animated, useSpring } from '@react-spring/three';
import {
    memo,
    type ReactNode,
    Suspense,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    BoxGeometry,
    type BufferGeometry,
    ConeGeometry,
    CylinderGeometry,
    DynamicDrawUsage,
    type InstancedMesh,
    type Material,
    MeshStandardMaterial,
    Object3D,
    PlaneGeometry,
} from 'three';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { resolveInGamePlantPreset } from '../../generators/plant/lib/inGamePlantPresets';
import { highTargetMockPlantRenderAttributesBySortId } from '../../hooks/mockGardenProfileFixtures';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useOperations } from '../../hooks/useOperations';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import {
    type OperationVisualDefinitionInput,
    resolveOperationVisualRewards,
} from '../../operationVisualRewards';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import { useGameState } from '../../useGameState';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import type { RaisedBedOrientation } from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { defaultGameWoodColor } from '../woodPalette';
import { mockPlantPresetLabelsBySortId } from './RaisedBedPlantField';
import {
    hasActiveRaisedBedProtectiveCover,
    resolveRaisedBedProtectiveCoverPositions,
} from './raisedBedAgrotextileRewards';
import {
    type FieldVisualChunk,
    reconcileFieldVisualChunks,
} from './raisedBedFieldVisualChunks';
import {
    createRaisedBedFieldCoverPrimitives,
    createRaisedBedFieldSeedDescriptors,
    createRaisedBedFieldSupportDescriptor,
    createRaisedBedFieldWeedTransforms,
    createRaisedBedWholeCoverPrimitives,
    getRaisedBedFieldVisualChunkKey,
    type RaisedBedCoverPrimitive,
    type RaisedBedFieldVisualTransform,
    type RaisedBedFieldVisualVector3,
} from './raisedBedFieldVisualLayout';
import { shouldRenderRaisedBedPlant } from './raisedBedPlantVisualStatus';
import { resolveRaisedBedSupportPositions } from './raisedBedSupportRewards';
import { resolveRaisedBedFieldWeedLevel } from './raisedBedWeedState';

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;
type PlantSortData = NonNullable<
    ReturnType<typeof useAllSorts>['data']
>[number];
type ShoppingCartData = NonNullable<ReturnType<typeof useShoppingCart>['data']>;

export type RaisedBedFieldVisualBatchBlock = {
    blockId: string;
    chunkPosition?: RaisedBedFieldVisualVector3;
    position: RaisedBedFieldVisualVector3;
};

export type RaisedBedFieldVisualLayer =
    | 'cover-bar'
    | 'cover-hem'
    | 'cover-plane'
    | 'seed-pending'
    | 'seed-sown'
    | 'support'
    | 'weed';

export type RaisedBedFieldVisualInstance = {
    id: string;
    position: readonly [number, number, number];
    rotation: readonly [number, number, number];
    scale: readonly [number, number, number];
};

export type RaisedBedFieldVisualBatch = {
    capacity: number;
    chunkKey: string;
    instances: RaisedBedFieldVisualInstance[];
    key: string;
    layer: RaisedBedFieldVisualLayer;
    signature: string;
};

type DisplayedField = {
    id: number | string;
    plantSortId: number | null | undefined;
    plantStatus?: string | null;
    plantSowDate?: string | null;
    positionIndex: number;
};

type MutableBatch = Omit<RaisedBedFieldVisualBatch, 'capacity' | 'signature'>;

function nextPowerOfTwo(value: number) {
    let capacity = 1;
    while (capacity < value) {
        capacity *= 2;
    }
    return capacity;
}

function addVisualInstance(
    batches: Map<string, MutableBatch>,
    chunkKey: string,
    layer: RaisedBedFieldVisualLayer,
    instance: RaisedBedFieldVisualInstance,
    batchGroupKey?: string,
) {
    const key = [chunkKey, layer, batchGroupKey].filter(Boolean).join(':');
    const existing = batches.get(key);
    if (existing) {
        existing.instances.push(instance);
        return;
    }

    batches.set(key, {
        chunkKey,
        instances: [instance],
        key,
        layer,
    });
}

function addTransformInstance({
    batches,
    chunkKey,
    id,
    layer,
    transform,
    batchGroupKey,
}: {
    batches: Map<string, MutableBatch>;
    chunkKey: string;
    id: string;
    layer: RaisedBedFieldVisualLayer;
    transform: RaisedBedFieldVisualTransform;
    batchGroupKey?: string;
}) {
    addVisualInstance(
        batches,
        chunkKey,
        layer,
        {
            id,
            ...transform,
        },
        batchGroupKey,
    );
}

function addCoverPrimitives({
    batches,
    chunkKey,
    coverPlaneGroupKey,
    primitives,
}: {
    batches: Map<string, MutableBatch>;
    chunkKey: string;
    coverPlaneGroupKey: string;
    primitives: readonly RaisedBedCoverPrimitive[];
}) {
    for (const primitive of primitives) {
        const layer =
            primitive.layer === 'cover-surface'
                ? 'cover-plane'
                : primitive.layer;
        addTransformInstance({
            batches,
            chunkKey,
            id: primitive.key,
            layer,
            transform: primitive.transform,
            // Three sorts transparent objects, not individual instances.
            // One plane batch per bed preserves depth ordering between beds
            // while still collapsing every coplanar field cover in that bed.
            batchGroupKey:
                layer === 'cover-plane' ? coverPlaneGroupKey : undefined,
        });
    }
}

function addSeedInstances({
    batches,
    blockIndex,
    blockPosition,
    chunkKey,
    field,
    highTargetProfile,
    isMock,
    isSandbox,
    localPositionIndex,
    orientation,
    raisedBedId,
    sortData,
}: {
    batches: Map<string, MutableBatch>;
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    chunkKey: string;
    field: DisplayedField;
    highTargetProfile: boolean;
    isMock: boolean;
    isSandbox: boolean;
    localPositionIndex: number;
    orientation: RaisedBedOrientation;
    raisedBedId: number;
    sortData: PlantSortData[] | undefined;
}) {
    const plantSortId = field.plantSortId;
    if (!plantSortId) {
        return;
    }
    const sort = sortData?.find((item) => item.id === plantSortId);
    const highTargetAttributes = highTargetProfile
        ? highTargetMockPlantRenderAttributesBySortId[plantSortId]
        : undefined;
    const resolvedPlantPreset = resolveInGamePlantPreset([
        sort?.information.name,
        sort?.information.plant.information?.name,
        sort?.information.plant.information?.latinName,
        isMock || isSandbox
            ? mockPlantPresetLabelsBySortId[plantSortId]
            : undefined,
    ]);
    if (resolvedPlantPreset && shouldRenderRaisedBedPlant(field)) {
        return;
    }

    const { plantsPerRow, totalPlants } = calculatePlantsPerField(
        highTargetAttributes?.seedingDistance ??
            sort?.information.plant.attributes?.seedingDistance,
    );
    const descriptors = createRaisedBedFieldSeedDescriptors({
        blockIndex,
        blockPosition,
        keyPrefix: `seed:${raisedBedId}:${field.positionIndex}:${field.id}`,
        orientation,
        plantsPerRow,
        positionIndex: localPositionIndex,
        sown: Boolean(field.plantSowDate),
        totalPlants,
    });

    for (const descriptor of descriptors) {
        addTransformInstance({
            batches,
            chunkKey,
            id: descriptor.key,
            layer: descriptor.layer,
            transform: descriptor.transform,
        });
    }
}

function batchSignature(instances: readonly RaisedBedFieldVisualInstance[]) {
    return instances
        .map(
            (instance) =>
                `${instance.id}:${instance.position.join(',')}:${instance.rotation.join(',')}:${instance.scale.join(',')}`,
        )
        .join('|');
}

export function reconcileRaisedBedFieldVisualBatches(
    previous: readonly RaisedBedFieldVisualBatch[],
    next: readonly RaisedBedFieldVisualBatch[],
) {
    const groupByChunk = (
        batches: readonly RaisedBedFieldVisualBatch[],
    ): FieldVisualChunk<RaisedBedFieldVisualBatch>[] => {
        const chunks = new Map<
            string,
            FieldVisualChunk<RaisedBedFieldVisualBatch>
        >();

        for (const batch of batches) {
            const chunk = chunks.get(batch.chunkKey);
            if (chunk) {
                chunks.set(batch.chunkKey, {
                    ...chunk,
                    layers: [...chunk.layers, batch],
                });
            } else {
                chunks.set(batch.chunkKey, {
                    key: batch.chunkKey,
                    layers: [batch],
                });
            }
        }

        return Array.from(chunks.values());
    };
    const reconciled = reconcileFieldVisualChunks(
        groupByChunk(previous),
        groupByChunk(next),
    ).flatMap((chunk) => chunk.layers);
    const unchanged =
        previous.length === reconciled.length &&
        previous.every((batch, index) => batch === reconciled[index]);

    return unchanged ? previous : reconciled;
}

export function compileRaisedBedFieldVisualBatches({
    blocks,
    cart,
    currentGarden,
    highTargetProfile,
    isMock,
    isSandbox,
    operations,
    sortData,
}: {
    blocks: readonly RaisedBedFieldVisualBatchBlock[];
    cart: ShoppingCartData | null | undefined;
    currentGarden: CurrentGardenData | null | undefined;
    highTargetProfile: boolean;
    isMock: boolean;
    isSandbox: boolean;
    operations: OperationVisualDefinitionInput[] | undefined;
    sortData: PlantSortData[] | undefined;
}): RaisedBedFieldVisualBatch[] {
    if (!currentGarden) {
        return [];
    }

    const blockById = new Map(blocks.map((block) => [block.blockId, block]));
    const mutableBatches = new Map<string, MutableBatch>();

    for (const raisedBed of currentGarden.raisedBeds) {
        const blockIds = getRaisedBedBlockIds(currentGarden, raisedBed.id);
        const raisedBedBlocks = blockIds.flatMap((blockId, blockIndex) => {
            const block = blockById.get(blockId);
            return block ? [{ ...block, blockIndex }] : [];
        });
        if (raisedBedBlocks.length === 0) {
            continue;
        }

        const orientation = raisedBed.orientation ?? 'vertical';
        const chunkKey = getRaisedBedFieldVisualChunkKey({
            positions: raisedBedBlocks.map(
                (block) => block.chunkPosition ?? block.position,
            ),
        });
        if (!chunkKey) {
            continue;
        }
        const visualRewards = resolveOperationVisualRewards({
            appliedOperations: (raisedBed.appliedOperations ?? []).map(
                (operation) => ({
                    ...operation,
                    raisedBedId: raisedBed.id,
                }),
            ),
            operationItems: [],
            operations: operations ?? [],
        });
        const hasWholeBedCover = hasActiveRaisedBedProtectiveCover({
            raisedBedId: raisedBed.id,
            visualRewards,
        });

        if (hasWholeBedCover) {
            addCoverPrimitives({
                batches: mutableBatches,
                chunkKey,
                coverPlaneGroupKey: `raised-bed-${raisedBed.id}`,
                primitives: createRaisedBedWholeCoverPrimitives({
                    blocks: raisedBedBlocks,
                    keyPrefix: `cover:${raisedBed.id}:whole`,
                    orientation,
                }),
            });
        }

        for (const [blockIndex, blockId] of blockIds.entries()) {
            const block = blockById.get(blockId);
            if (!block) {
                continue;
            }
            const blockOffset =
                Math.max(blockIds.length - 1 - blockIndex, 0) * 9;
            const protectiveCoverPositions =
                resolveRaisedBedProtectiveCoverPositions({
                    blockOffset,
                    fields: raisedBed.fields,
                    raisedBedId: raisedBed.id,
                    visualRewards,
                });
            const protectiveCoverPositionSet = new Set(
                protectiveCoverPositions,
            );
            const fieldCoverPositions = hasWholeBedCover
                ? []
                : protectiveCoverPositions;
            const supportPositions = resolveRaisedBedSupportPositions({
                blockOffset,
                fields: raisedBed.fields,
                raisedBedId: raisedBed.id,
                visualRewards,
            }).filter(
                (positionIndex) =>
                    !protectiveCoverPositionSet.has(positionIndex),
            );

            for (const localPositionIndex of fieldCoverPositions) {
                addCoverPrimitives({
                    batches: mutableBatches,
                    chunkKey,
                    coverPlaneGroupKey: `raised-bed-${raisedBed.id}`,
                    primitives: createRaisedBedFieldCoverPrimitives({
                        blockIndex,
                        blockPosition: block.position,
                        keyPrefix: `cover:${raisedBed.id}:${blockIndex}:${localPositionIndex}`,
                        orientation,
                        positionIndex: localPositionIndex,
                    }),
                });
            }
            for (const localPositionIndex of supportPositions) {
                const descriptor = createRaisedBedFieldSupportDescriptor({
                    blockIndex,
                    blockPosition: block.position,
                    key: `support:${raisedBed.id}:${blockIndex}:${localPositionIndex}`,
                    orientation,
                    positionIndex: localPositionIndex,
                });
                addTransformInstance({
                    batches: mutableBatches,
                    chunkKey,
                    id: descriptor.key,
                    layer: descriptor.layer,
                    transform: descriptor.transform,
                });
            }

            const persistedFields = raisedBed.fields
                .filter(
                    (field) =>
                        isRaisedBedFieldOccupied(field) &&
                        field.positionIndex >= blockOffset &&
                        field.positionIndex < blockOffset + 9,
                )
                .map(
                    (field): DisplayedField => ({
                        id: field.id,
                        plantSortId: field.plantSortId,
                        plantStatus: field.plantStatus,
                        plantSowDate: field.plantSowDate,
                        positionIndex: field.positionIndex,
                    }),
                );
            const cartFields =
                cart?.items.flatMap((item): DisplayedField[] => {
                    if (
                        item.gardenId !== currentGarden.id ||
                        item.raisedBedId !== raisedBed.id ||
                        item.entityTypeName !== 'plantSort' ||
                        typeof item.positionIndex !== 'number' ||
                        item.positionIndex < blockOffset ||
                        item.positionIndex >= blockOffset + 9
                    ) {
                        return [];
                    }
                    return [
                        {
                            id: `cart-item-${item.id}`,
                            plantSortId: Number(item.entityId),
                            positionIndex: item.positionIndex,
                        },
                    ];
                }) ?? [];

            for (
                let localPositionIndex = 0;
                localPositionIndex < 9;
                localPositionIndex += 1
            ) {
                if (protectiveCoverPositionSet.has(localPositionIndex)) {
                    continue;
                }
                const positionIndex = blockOffset + localPositionIndex;
                const field = raisedBed.fields.find(
                    (candidate) =>
                        candidate.active &&
                        candidate.positionIndex === positionIndex,
                );
                const weedLevel = resolveRaisedBedFieldWeedLevel({
                    fieldWeedState: field?.weedState,
                    raisedBedFieldId:
                        typeof field?.id === 'number' ? field.id : null,
                    raisedBedId: raisedBed.id,
                    raisedBedWeedState: raisedBed.weedState,
                    visualRewards,
                });
                if (weedLevel) {
                    const transforms = createRaisedBedFieldWeedTransforms({
                        blockIndex,
                        blockPosition: block.position,
                        level: weedLevel,
                        orientation,
                        positionIndex: localPositionIndex,
                    });
                    const seedPositionIndex =
                        blockIndex * 9 + localPositionIndex;

                    transforms.forEach((transform, bladeIndex) => {
                        addTransformInstance({
                            batches: mutableBatches,
                            chunkKey,
                            id: `weed:${raisedBed.id}:${seedPositionIndex}:${bladeIndex}`,
                            layer: 'weed',
                            transform,
                        });
                    });
                }
            }

            for (const field of [...persistedFields, ...cartFields]) {
                const localPositionIndex = field.positionIndex - blockOffset;
                if (protectiveCoverPositionSet.has(localPositionIndex)) {
                    continue;
                }
                addSeedInstances({
                    batches: mutableBatches,
                    blockIndex,
                    blockPosition: block.position,
                    chunkKey,
                    field,
                    highTargetProfile,
                    isMock,
                    isSandbox,
                    localPositionIndex,
                    orientation,
                    raisedBedId: raisedBed.id,
                    sortData,
                });
            }
        }
    }

    return Array.from(mutableBatches.values())
        .map((batch): RaisedBedFieldVisualBatch => {
            const instances = batch.instances.sort((left, right) =>
                left.id.localeCompare(right.id),
            );
            return {
                ...batch,
                capacity: nextPowerOfTwo(instances.length),
                instances,
                signature: batchSignature(instances),
            };
        })
        .sort((left, right) => left.key.localeCompare(right.key));
}

function createFieldVisualMaterials() {
    const materials = {
        coverBar: new MeshStandardMaterial({
            color: '#c9c2ad',
            roughness: 1,
        }),
        coverHem: new MeshStandardMaterial({
            color: '#eee9d8',
            roughness: 1,
        }),
        coverPlane: new MeshStandardMaterial({
            color: '#dcd7c6',
            depthWrite: false,
            opacity: 0.76,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            roughness: 1,
            transparent: true,
        }),
        seedSown: new MeshStandardMaterial({
            color: '#4b3223',
            opacity: 0.72,
            roughness: 0.95,
            transparent: true,
        }),
        support: new MeshStandardMaterial({
            color: defaultGameWoodColor,
            roughness: 0.9,
        }),
        weed: new MeshStandardMaterial({
            color: '#4b7f3b',
            roughness: 1,
        }),
    };

    return materials;
}

function createFieldVisualGeometries() {
    return {
        box: new BoxGeometry(1, 1, 1),
        coverPlane: new PlaneGeometry(1, 1),
        support: new CylinderGeometry(0.018, 0.022, 0.78, 6),
        weed: new ConeGeometry(1, 1, 4),
    };
}

const fieldVisualProfileUploads = new Map<
    string,
    {
        instanceCount: number;
        token: symbol;
    }
>();

function publishFieldVisualProfileUploads() {
    updateGameProfileMetadata({
        raisedBedFieldVisualMatrixUploadCount: fieldVisualProfileUploads.size,
        raisedBedFieldVisualUploadedInstanceCount: Array.from(
            fieldVisualProfileUploads.values(),
        ).reduce((total, upload) => total + upload.instanceCount, 0),
    });
}

const FieldVisualInstancedMesh = memo(function FieldVisualInstancedMesh({
    batch,
    castShadow = false,
    children,
    geometry,
    material,
    receiveShadow = false,
    renderOrder,
}: {
    batch: RaisedBedFieldVisualBatch;
    castShadow?: boolean;
    children?: ReactNode;
    geometry: BufferGeometry;
    material?: Material;
    receiveShadow?: boolean;
    renderOrder?: number;
}) {
    const meshRef = useRef<InstancedMesh | null>(null);
    const scratch = useMemo(() => new Object3D(), []);
    const profileUploadToken = useRef(Symbol(batch.key)).current;

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.instanceMatrix.clearUpdateRanges();
        batch.instances.forEach((instance, index) => {
            scratch.position.set(...instance.position);
            scratch.rotation.set(...instance.rotation);
            scratch.scale.set(...instance.scale);
            scratch.updateMatrix();
            mesh.setMatrixAt(index, scratch.matrix);
        });
        mesh.count = batch.instances.length;
        mesh.instanceMatrix.addUpdateRange(0, batch.instances.length * 16);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        if (
            typeof window !== 'undefined' &&
            window.location.pathname.startsWith('/debug/profile/game')
        ) {
            fieldVisualProfileUploads.set(batch.key, {
                instanceCount: batch.instances.length,
                token: profileUploadToken,
            });
            publishFieldVisualProfileUploads();
        }

        return () => {
            if (
                fieldVisualProfileUploads.get(batch.key)?.token !==
                profileUploadToken
            ) {
                return;
            }
            fieldVisualProfileUploads.delete(batch.key);
            publishFieldVisualProfileUploads();
        };
    }, [batch, profileUploadToken, scratch]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, batch.capacity]}
            castShadow={castShadow}
            name={`RaisedBedFieldVisualBatch:${batch.key}:count:${batch.instances.length}`}
            receiveShadow={receiveShadow}
            renderOrder={renderOrder}
        >
            {children}
        </instancedMesh>
    );
});

const SeedFieldVisualInstancedMesh = memo(
    function SeedFieldVisualInstancedMesh({
        batch,
        children,
        material,
    }: {
        batch: RaisedBedFieldVisualBatch;
        children?: ReactNode;
        material?: Material;
    }) {
        const { nodes } = useGameGLTF('Seed');

        return (
            <FieldVisualInstancedMesh
                batch={batch}
                castShadow
                geometry={nodes.Seed.geometry}
                material={material}
                receiveShadow
            >
                {children}
            </FieldVisualInstancedMesh>
        );
    },
);

export function RaisedBedFieldVisualBatches({
    blocks,
}: {
    blocks: RaisedBedFieldVisualBatchBlock[];
}) {
    const { includePendingCartPlants, renderDetails } = useGameSceneDetails();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const isMock = useGameState((state) => state.isMock);
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const isSandbox = useIsSandboxGarden();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: sortData } = useAllSorts(!isMock);
    const { data: cart } = useShoppingCart(
        includePendingCartPlants && renderDetails && !isLocalSandbox && !isMock,
    );
    const materials = useMemo(createFieldVisualMaterials, []);
    const geometries = useMemo(createFieldVisualGeometries, []);
    const previousBatchesRef = useRef<readonly RaisedBedFieldVisualBatch[]>([]);
    const compiledBatches = useMemo(
        () =>
            renderDetails
                ? compileRaisedBedFieldVisualBatches({
                      blocks,
                      cart,
                      currentGarden,
                      highTargetProfile: mockGardenProfile === 'high-target',
                      isMock,
                      isSandbox,
                      operations,
                      sortData,
                  })
                : [],
        [
            blocks,
            cart,
            currentGarden,
            isMock,
            isSandbox,
            mockGardenProfile,
            operations,
            renderDetails,
            sortData,
        ],
    );
    const batches = useMemo(() => {
        const reconciled = reconcileRaisedBedFieldVisualBatches(
            previousBatchesRef.current,
            compiledBatches,
        );
        previousBatchesRef.current = reconciled;
        return reconciled;
    }, [compiledBatches]);
    const seedPulse = useSpring({
        cancel: !batches.some((batch) => batch.layer === 'seed-pending'),
        duration: 1000,
        from: { opacity: 1 },
        loop: true,
        to: [{ opacity: 0.5 }, { opacity: 1 }],
    });

    useEffect(
        () => () => {
            for (const material of Object.values(materials)) {
                material.dispose();
            }
            for (const geometry of Object.values(geometries)) {
                geometry.dispose();
            }
        },
        [geometries, materials],
    );
    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !window.location.pathname.startsWith('/debug/profile/game')
        ) {
            return;
        }
        updateGameProfileMetadata({
            raisedBedFieldVisualBatchCount: batches.length,
            raisedBedFieldVisualChunkCount: new Set(
                batches.map((batch) => batch.chunkKey),
            ).size,
            raisedBedFieldVisualInstanceCount: batches.reduce(
                (total, batch) => total + batch.instances.length,
                0,
            ),
            raisedBedFieldVisualObjectCount: batches.length,
        });
    }, [batches]);

    if (!renderDetails || batches.length === 0) {
        return null;
    }

    return (
        <group name={`RaisedBedFieldVisualBatches:batches:${batches.length}`}>
            {batches.map((batch) => {
                switch (batch.layer) {
                    case 'weed':
                        return (
                            <FieldVisualInstancedMesh
                                key={`${batch.key}:${batch.capacity}`}
                                batch={batch}
                                geometry={geometries.weed}
                                material={materials.weed}
                            />
                        );
                    case 'support':
                        return (
                            <FieldVisualInstancedMesh
                                key={`${batch.key}:${batch.capacity}`}
                                batch={batch}
                                castShadow
                                geometry={geometries.support}
                                material={materials.support}
                                renderOrder={8}
                            />
                        );
                    case 'cover-plane':
                        return (
                            <FieldVisualInstancedMesh
                                key={`${batch.key}:${batch.capacity}`}
                                batch={batch}
                                geometry={geometries.coverPlane}
                                material={materials.coverPlane}
                                renderOrder={4}
                            />
                        );
                    case 'cover-hem':
                        return (
                            <FieldVisualInstancedMesh
                                key={`${batch.key}:${batch.capacity}`}
                                batch={batch}
                                geometry={geometries.box}
                                material={materials.coverHem}
                                renderOrder={5}
                            />
                        );
                    case 'cover-bar':
                        return (
                            <FieldVisualInstancedMesh
                                key={`${batch.key}:${batch.capacity}`}
                                batch={batch}
                                geometry={geometries.box}
                                material={materials.coverBar}
                                renderOrder={6}
                            />
                        );
                    case 'seed-sown':
                        return (
                            <Suspense
                                key={`${batch.key}:${batch.capacity}`}
                                fallback={null}
                            >
                                <SeedFieldVisualInstancedMesh
                                    batch={batch}
                                    material={materials.seedSown}
                                />
                            </Suspense>
                        );
                    case 'seed-pending':
                        return (
                            <Suspense
                                key={`${batch.key}:${batch.capacity}`}
                                fallback={null}
                            >
                                <SeedFieldVisualInstancedMesh batch={batch}>
                                    <animated.meshStandardMaterial
                                        color="#6495ED"
                                        opacity={seedPulse.opacity}
                                        roughness={0.95}
                                        transparent
                                    />
                                </SeedFieldVisualInstancedMesh>
                            </Suspense>
                        );
                    default:
                        return null;
                }
            })}
        </group>
    );
}
