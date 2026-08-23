import { asc, eq, inArray, isNotNull, like, or } from 'drizzle-orm';
import {
    bustRaisedBedPlantingReadCaches,
    closeStorage,
    createRaisedBedPlanting,
    entities,
    events,
    RaisedBedPlantingError,
    raisedBedFields,
    raisedBedPlantingFields,
    raisedBedPlantings,
    raisedBeds,
    storage,
} from '../src';
import {
    type AdvancedSowingBackfillExistingPlanting,
    AdvancedSowingPlantingsBackfillError,
    type AdvancedSowingPlantingsBackfillPlanInput,
    advancedSowingPlantCycleEventTypes,
    assertAdvancedSowingPlantingsBackfillReadback,
    assertAdvancedSowingSourceHistoryUnchanged,
    parseAdvancedSowingPlantingsBackfillArgs,
    planAdvancedSowingPlantingsBackfill,
    summarizeAdvancedSowingPlantingsBackfillPlan,
} from './lib/advancedSowingPlantingsBackfill';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

async function loadExistingPlantings(db: DatabaseClient) {
    const plantingRows = await db
        .select({
            id: raisedBedPlantings.id,
            raisedBedId: raisedBedPlantings.raisedBedId,
            plantSortId: raisedBedPlantings.plantSortId,
            eventAggregateId: raisedBedPlantings.eventAggregateId,
            legacyPlantPlaceEventId: raisedBedPlantings.legacyPlantPlaceEventId,
            anchorPositionIndex: raisedBedPlantings.anchorPositionIndex,
            minSeedingDistanceCm: raisedBedPlantings.minSeedingDistanceCm,
            optimalSeedingDistanceCm:
                raisedBedPlantings.optimalSeedingDistanceCm,
            maxSeedingDistanceCm: raisedBedPlantings.maxSeedingDistanceCm,
            selectedSeedingDistanceCm:
                raisedBedPlantings.selectedSeedingDistanceCm,
            plantsPerAxis: raisedBedPlantings.plantsPerAxis,
            plantCount: raisedBedPlantings.plantCount,
            layoutKey: raisedBedPlantings.layoutKey,
            spanRows: raisedBedPlantings.spanRows,
            spanColumns: raisedBedPlantings.spanColumns,
            layoutVersion: raisedBedPlantings.layoutVersion,
            configurationSource: raisedBedPlantings.configurationSource,
            isActive: raisedBedPlantings.isActive,
            isDeleted: raisedBedPlantings.isDeleted,
        })
        .from(raisedBedPlantings)
        .where(
            or(
                eq(raisedBedPlantings.configurationSource, 'legacy'),
                isNotNull(raisedBedPlantings.legacyPlantPlaceEventId),
                like(
                    raisedBedPlantings.eventAggregateId,
                    'raised-bed-planting:legacy:%',
                ),
            ),
        )
        .orderBy(asc(raisedBedPlantings.id));
    if (plantingRows.length === 0) {
        return [];
    }

    const plantingIds = plantingRows.map((planting) => planting.id);
    const membershipRows = await db
        .select({
            plantingId: raisedBedPlantingFields.plantingId,
            raisedBedFieldId: raisedBedPlantingFields.raisedBedFieldId,
            relativeRow: raisedBedPlantingFields.relativeRow,
            relativeColumn: raisedBedPlantingFields.relativeColumn,
            isAnchor: raisedBedPlantingFields.isAnchor,
            isDeleted: raisedBedPlantingFields.isDeleted,
        })
        .from(raisedBedPlantingFields)
        .where(inArray(raisedBedPlantingFields.plantingId, plantingIds))
        .orderBy(
            asc(raisedBedPlantingFields.plantingId),
            asc(raisedBedPlantingFields.id),
        );
    const membershipsByPlantingId = new Map<
        number,
        AdvancedSowingBackfillExistingPlanting['memberships']
    >();
    for (const membership of membershipRows) {
        const existing =
            membershipsByPlantingId.get(membership.plantingId) ?? [];
        existing.push({
            raisedBedFieldId: membership.raisedBedFieldId,
            relativeRow: membership.relativeRow,
            relativeColumn: membership.relativeColumn,
            isAnchor: membership.isAnchor,
            isDeleted: membership.isDeleted,
        });
        membershipsByPlantingId.set(membership.plantingId, existing);
    }

    return plantingRows.map(
        (planting): AdvancedSowingBackfillExistingPlanting => ({
            ...planting,
            memberships: membershipsByPlantingId.get(planting.id) ?? [],
        }),
    );
}

async function loadBackfillState(
    db: DatabaseClient,
): Promise<AdvancedSowingPlantingsBackfillPlanInput> {
    const sourceEvents = await db
        .select({
            id: events.id,
            type: events.type,
            version: events.version,
            aggregateId: events.aggregateId,
            data: events.data,
            createdAt: events.createdAt,
        })
        .from(events)
        .where(inArray(events.type, [...advancedSowingPlantCycleEventTypes]))
        .orderBy(asc(events.createdAt), asc(events.id));
    const raisedBedRows = await db
        .select({ id: raisedBeds.id, isDeleted: raisedBeds.isDeleted })
        .from(raisedBeds)
        .orderBy(asc(raisedBeds.id));
    const fieldRows = await db
        .select({
            id: raisedBedFields.id,
            raisedBedId: raisedBedFields.raisedBedId,
            positionIndex: raisedBedFields.positionIndex,
            createdAt: raisedBedFields.createdAt,
            isDeleted: raisedBedFields.isDeleted,
        })
        .from(raisedBedFields)
        .orderBy(
            asc(raisedBedFields.raisedBedId),
            asc(raisedBedFields.positionIndex),
            asc(raisedBedFields.createdAt),
            asc(raisedBedFields.id),
        );
    const entityRows = await db
        .select({
            id: entities.id,
            entityTypeName: entities.entityTypeName,
            isDeleted: entities.isDeleted,
        })
        .from(entities)
        .orderBy(asc(entities.id));
    const existingPlantings = await loadExistingPlantings(db);

    return {
        sourceEvents,
        raisedBeds: raisedBedRows,
        fields: fieldRows,
        entities: entityRows,
        existingPlantings,
    };
}

async function applyBackfill(
    preflightState: AdvancedSowingPlantingsBackfillPlanInput,
) {
    const database = storage();
    let attempted = 0;
    let unchanged = 0;
    let created = 0;
    let replayed = 0;
    let sourcePlantPlaceCycles = 0;
    let projectedLegacyBefore = 0;

    await database.transaction(async (transaction) => {
        const currentState = await loadBackfillState(transaction);
        assertAdvancedSowingSourceHistoryUnchanged(
            preflightState.sourceEvents,
            currentState.sourceEvents,
        );
        const currentPlan = planAdvancedSowingPlantingsBackfill(currentState);
        attempted = currentPlan.entries.filter(
            (entry) => entry.action === 'create',
        ).length;
        unchanged = currentPlan.entries.length - attempted;
        sourcePlantPlaceCycles = currentPlan.sourceCycleCount;
        projectedLegacyBefore = currentPlan.existingLegacyProjectionCount;

        for (const entry of currentPlan.entries) {
            if (entry.action !== 'create') {
                continue;
            }
            try {
                const result = await createRaisedBedPlanting(
                    entry.input,
                    transaction,
                );
                if (result.created) {
                    created += 1;
                } else {
                    replayed += 1;
                }
            } catch (error) {
                if (error instanceof RaisedBedPlantingError) {
                    throw new AdvancedSowingPlantingsBackfillError(
                        'projection_mismatch',
                        { eventId: entry.sourceEventId },
                    );
                }
                throw error;
            }
        }
    });

    if (created > 0) {
        await bustRaisedBedPlantingReadCaches();
    }

    return {
        attempted,
        unchanged,
        created,
        replayed,
        sourcePlantPlaceCycles,
        projectedLegacyBefore,
        projectedLegacyAfter: projectedLegacyBefore + created + replayed,
    };
}

async function main() {
    const { apply } = parseAdvancedSowingPlantingsBackfillArgs(
        process.argv.slice(2),
    );
    const preflightState = await loadBackfillState(storage());
    const preflightPlan = planAdvancedSowingPlantingsBackfill(preflightState);
    const preflight =
        summarizeAdvancedSowingPlantingsBackfillPlan(preflightPlan);

    if (!apply) {
        return {
            mode: 'dry-run',
            preflight,
            apply: null,
            readback: null,
        };
    }

    const applied = await applyBackfill(preflightState);
    const readbackState = await loadBackfillState(storage());
    assertAdvancedSowingSourceHistoryUnchanged(
        preflightState.sourceEvents,
        readbackState.sourceEvents,
    );
    const readbackPlan =
        assertAdvancedSowingPlantingsBackfillReadback(readbackState);
    const readback = summarizeAdvancedSowingPlantingsBackfillPlan(readbackPlan);

    return {
        mode: 'apply',
        preflight,
        apply: {
            counts: applied,
            assertions: {
                sourceProjectedCountMatch:
                    applied.projectedLegacyAfter ===
                    applied.sourcePlantPlaceCycles,
            },
        },
        readback: {
            ...readback,
            assertions: {
                ...readback.assertions,
                sourceEventsUnchanged: true,
                rerunNoop: readback.reasonCounts.create === 0,
            },
        },
    };
}

main()
    .then((report) => {
        console.log(JSON.stringify(report, null, 2));
    })
    .catch((error: unknown) => {
        if (error instanceof AdvancedSowingPlantingsBackfillError) {
            console.error(
                JSON.stringify(
                    {
                        status: 'failed',
                        reasonCode: error.reasonCode,
                        diagnostics: error.diagnostics,
                    },
                    null,
                    2,
                ),
            );
        } else {
            console.error(
                JSON.stringify(
                    { status: 'failed', reasonCode: 'unexpected_error' },
                    null,
                    2,
                ),
            );
        }
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
