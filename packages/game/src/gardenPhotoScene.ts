import type { GameCameraSnapshot } from './controls/GameCameraRigApi';
import type { CurrentGarden } from './hooks/useCurrentGarden';
import type { PublicGardenDetail } from './viewers/PublicGardenViewer';

function projectWeedState(
    weedState: CurrentGarden['raisedBeds'][number]['weedState'],
) {
    return weedState
        ? {
              level: weedState.level,
              source: weedState.source,
              observedAt: '',
              updatedAt: '',
              eventId: 0,
          }
        : null;
}

/** Render-only projection. No sign messages, owner/location identifiers, names or private notes. */
export function createGardenPhotoScene(
    garden: CurrentGarden,
    camera: GameCameraSnapshot,
    viewport: { width: number; height: number },
) {
    if (
        ![
            ...camera.position,
            ...camera.target,
            camera.zoom,
            viewport.width,
            viewport.height,
        ].every(Number.isFinite) ||
        camera.zoom <= 0 ||
        viewport.width < 1 ||
        viewport.height < 1
    )
        throw new Error('Current camera is unavailable');
    const scale = Math.min(1, 1600 / Math.max(viewport.width, viewport.height));
    const width = Math.max(1, Math.round(viewport.width * scale));
    const height = Math.max(1, Math.round(viewport.height * scale));
    const blockIds = new Map<string, string>();
    const stacks: PublicGardenDetail['stacks'] = {};
    let ordinal = 0;
    for (const stack of garden.stacks) {
        const rows = stacks[stack.position.x.toString()] ?? {};
        rows[stack.position.z.toString()] = stack.blocks.map((block) => {
            const id = `photo-block-${++ordinal}`;
            blockIds.set(block.id, id);
            return {
                id,
                name: block.name,
                rotation: block.rotation,
                variant: block.variant,
            };
        });
        stacks[stack.position.x.toString()] = rows;
    }
    const raisedBeds: PublicGardenDetail['raisedBeds'] = garden.raisedBeds.map(
        (bed, index) => {
            const id = index + 1;
            return {
                id,
                name: '',
                physicalId: null,
                blockId: bed.blockId
                    ? (blockIds.get(bed.blockId) ?? null)
                    : null,
                status: bed.status,
                weedState: projectWeedState(bed.weedState),
                abandonReason: null,
                orientation: bed.orientation,
                createdAt: '',
                updatedAt: '',
                isValid: bed.isValid,
                fields: bed.fields.map((field, fieldIndex) => ({
                    id: fieldIndex + 1,
                    raisedBedId: id,
                    positionIndex: field.positionIndex,
                    createdAt: '',
                    updatedAt: '',
                    isDeleted: field.isDeleted,
                    plantCycles: field.plantCycles
                        .filter((cycle) => cycle.active)
                        .map((cycle, cycleIndex) => ({
                            aggregateId: `photo-cycle-${id}-${fieldIndex + 1}-${cycleIndex + 1}`,
                            positionIndex: cycle.positionIndex,
                            plantPlaceEventId: 0,
                            eventIds: [],
                            startedAt: cycle.startedAt,
                            endedAt: cycle.endedAt,
                            endedEventId: 0,
                            active: cycle.active,
                            plantSortId: cycle.plantSortId,
                            plantStatus: cycle.plantStatus,
                            sowingLocation: cycle.sowingLocation,
                            plantScheduledDate: undefined,
                            plantSowDate: cycle.plantSowDate,
                            plantGrowthDate: cycle.plantGrowthDate,
                            plantReadyDate: cycle.plantReadyDate,
                            plantDeadDate: cycle.plantDeadDate,
                            plantHarvestedDate: cycle.plantHarvestedDate,
                            plantRemovedDate: cycle.plantRemovedDate,
                            statusChanges: [],
                            stoppedDate: undefined,
                            cancellationReason: undefined,
                            toBeRemoved: cycle.toBeRemoved,
                        })),
                    plantStatus: field.plantStatus,
                    plantSortId: field.plantSortId,
                    plantStatusEventId: undefined,
                    plantStatusChangedAt: undefined,
                    plantScheduledDate: undefined,
                    sowingLocation: field.sowingLocation,
                    plantSowDate: field.plantSowDate,
                    plantGrowthDate: field.plantGrowthDate,
                    plantReadyDate: field.plantReadyDate,
                    plantDeadDate: field.plantDeadDate,
                    plantHarvestedDate: field.plantHarvestedDate,
                    plantRemovedDate: field.plantRemovedDate,
                    active: field.active,
                    toBeRemoved: field.toBeRemoved,
                    stoppedDate: undefined,
                    cancellationReason: undefined,
                    blockedAt: undefined,
                    blockedBy: undefined,
                    blockedEventId: undefined,
                    blockReasonCode: undefined,
                    blockReasonLabel: undefined,
                    blockNote: undefined,
                    blockImageUrls: undefined,
                    weedState: projectWeedState(field.weedState),
                })),
                appliedOperations: bed.appliedOperations.map(
                    (operation, operationIndex) => ({
                        id: operationIndex + 1,
                        entityId: operation.entityId,
                        raisedBedId: id,
                        raisedBedFieldId:
                            operation.raisedBedFieldId == null
                                ? null
                                : bed.fields.findIndex(
                                      (field) =>
                                          field.id ===
                                          operation.raisedBedFieldId,
                                  ) + 1,
                        status: operation.status,
                        createdAt: operation.createdAt,
                        completedAt: operation.completedAt,
                        scheduledDate: operation.scheduledDate,
                    }),
                ),
            };
        },
    );
    const scene: PublicGardenDetail = {
        id: 0,
        farmId: 0,
        name: '',
        updatedAt: '',
        isPublic: false,
        isSandbox: garden.isSandbox,
        latitude: 45.815,
        longitude: 15.982,
        backgroundPalette: garden.backgroundPalette,
        homeCamera: {
            position: [...camera.position],
            target: [...camera.target],
            zoom: camera.zoom * (width / viewport.width),
        },
        stacks,
        raisedBeds,
    };
    return { garden: scene, width, height };
}
