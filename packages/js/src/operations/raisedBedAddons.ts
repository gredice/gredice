import {
    type AppliedOperationVisualInput,
    getOperationVisualRewardFamily,
    getOperationVisualRewardPolarity,
    isAppliedOperationVisualStatus,
    type OperationVisualDefinitionInput,
    resolveOperationVisualRewardKind,
} from './operationVisualRewards';

export type RaisedBedAddon = {
    family: 'mulch' | 'supports' | 'agrotextile' | 'insectMesh';
    label: string;
    operationId: number;
    appliedAt: string;
    pendingVerification: boolean;
    scope: 'field' | 'planting' | 'raisedBed';
    positionNumbers: number[];
};

type AddonField = {
    id: number;
    positionIndex: number;
    active?: boolean | null;
    plantRemovedDate?: Date | string | null;
    plantCycles?: Array<{
        active: boolean;
        startedAt: Date | string;
        plantRemovedDate?: Date | string | null;
    }>;
};

function timestamp(value: Date | string | null | undefined) {
    if (!value) return null;
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : null;
}

/** Resolve physical additions, with newer removals overriding inherited bed coverage. */
export function resolveRaisedBedAddons({
    raisedBedId,
    positionNumbers,
    fields,
    plantings = [],
    operations,
    definitions,
}: {
    raisedBedId: number;
    positionNumbers: number[];
    fields: AddonField[];
    plantings?: Array<{
        id: number;
        isActive: boolean;
        isDeleted?: boolean;
        lifecycleStartedAt: Date | string;
        lifecycleStatus?: string | null;
        lifecycleStoppedAt?: Date | string | null;
        memberships: Array<{ raisedBedField: { positionIndex: number } }>;
    }>;
    operations: Array<
        AppliedOperationVisualInput & { plantingId?: number | null }
    >;
    definitions: OperationVisualDefinitionInput[];
}) {
    const definitionsById = new Map(definitions.map((item) => [item.id, item]));
    const byPosition = new Map(
        positionNumbers.map((position) => [
            position,
            new Map<string, RaisedBedAddon>(),
        ]),
    );
    const removedAtByPosition = new Map<number, number>();
    const recordRemoval = (
        position: number,
        removedAt: Date | string | null | undefined,
    ) => {
        const removedTimestamp = timestamp(removedAt);
        if (removedTimestamp !== null) {
            removedAtByPosition.set(
                position,
                Math.max(
                    removedAtByPosition.get(position) ?? -Infinity,
                    removedTimestamp,
                ),
            );
        }
    };
    // Physical cleanup belongs to the position, including after it is replanted.
    for (const field of fields) {
        recordRemoval(field.positionIndex + 1, field.plantRemovedDate);
        for (const cycle of field.plantCycles ?? []) {
            recordRemoval(field.positionIndex + 1, cycle.plantRemovedDate);
        }
    }
    for (const planting of plantings) {
        // Harvested/dead plants and cancelled plans are not physical removals.
        if (planting.lifecycleStatus !== 'removed') continue;
        for (const membership of planting.memberships) {
            recordRemoval(
                membership.raisedBedField.positionIndex + 1,
                planting.lifecycleStoppedAt,
            );
        }
    }
    const ordered = operations
        .flatMap((operation) => {
            const appliedAt =
                timestamp(operation.completedAt) ??
                timestamp(operation.createdAt);
            return appliedAt === null ? [] : [{ operation, appliedAt }];
        })
        .sort(
            (a, b) =>
                a.appliedAt - b.appliedAt || a.operation.id - b.operation.id,
        );

    for (const { operation, appliedAt } of ordered) {
        if (
            operation.raisedBedId !== raisedBedId ||
            !isAppliedOperationVisualStatus(operation.status)
        )
            continue;
        const definition = definitionsById.get(operation.entityId);
        const kind = resolveOperationVisualRewardKind(definition);
        if (!kind) continue;
        const family = getOperationVisualRewardFamily(kind);
        if (
            family !== 'mulch' &&
            family !== 'supports' &&
            family !== 'agrotextile' &&
            family !== 'insectMesh'
        )
            continue;

        let positions: number[];
        let scope: RaisedBedAddon['scope'];
        if (operation.plantingId != null) {
            const planting = plantings.find(
                (item) =>
                    item.id === operation.plantingId &&
                    item.isActive &&
                    !item.isDeleted,
            );
            if (
                !planting ||
                appliedAt < (timestamp(planting.lifecycleStartedAt) ?? Infinity)
            )
                continue;
            positions = planting.memberships.map(
                (item) => item.raisedBedField.positionIndex + 1,
            );
            scope = 'planting';
        } else if (operation.raisedBedFieldId != null) {
            const field = fields.find(
                (item) => item.id === operation.raisedBedFieldId,
            );
            if (!field) continue;
            const cycle = field.plantCycles?.find((item) => item.active);
            if (
                definition?.attributes?.appliesToEmptyFields !== true &&
                (!field.active ||
                    (cycle &&
                        appliedAt < (timestamp(cycle.startedAt) ?? Infinity)))
            )
                continue;
            positions = [field.positionIndex + 1];
            scope = 'field';
        } else {
            // A plant operation without a target must never become whole-bed coverage.
            if (
                !['raisedBedFull', 'raisedBed1m'].includes(
                    definition?.attributes?.application ?? '',
                )
            )
                continue;
            positions = positionNumbers;
            scope = 'raisedBed';
        }
        const addon: RaisedBedAddon = {
            family,
            label:
                definition?.information?.label ||
                definition?.information?.name ||
                family,
            operationId: operation.id,
            appliedAt: new Date(appliedAt).toISOString(),
            pendingVerification: operation.status === 'pendingVerification',
            scope,
            positionNumbers: [],
        };
        for (const position of positions) {
            // Removal clears every family, even inherited whole-bed coverage.
            // At equal timestamps cleanup wins; only a later application restores it.
            if (appliedAt <= (removedAtByPosition.get(position) ?? -Infinity))
                continue;
            const current = byPosition.get(position);
            if (getOperationVisualRewardPolarity(kind) === 'remove')
                current?.delete(family);
            else current?.set(family, addon);
        }
    }

    const active = new Map<number, RaisedBedAddon>();
    for (const [position, addons] of byPosition) {
        for (const addon of addons.values()) {
            const existing = active.get(addon.operationId);
            if (existing) existing.positionNumbers.push(position);
            else
                active.set(addon.operationId, {
                    ...addon,
                    positionNumbers: [position],
                });
        }
    }
    return [...active.values()].map((addon) => ({
        ...addon,
        positionNumbers: addon.positionNumbers.sort((a, b) => a - b),
    }));
}
