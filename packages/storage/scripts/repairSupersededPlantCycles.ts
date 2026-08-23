import { and, asc, eq, inArray } from 'drizzle-orm';
import {
    acquirePlantingScheduleTaskLock,
    bustScheduleCache,
    closeStorage,
    events,
    raisedBedFields,
    raisedBeds,
    storage,
} from '../src/index';
import {
    type PlantCycleRepairEvent,
    planSupersededPlantCycleRepairs,
} from './lib/supersededPlantCycles';

const plantCycleEventTypes = [
    'raisedBedField.delete',
    'raisedBedField.plantBlock',
    'raisedBedField.plantPlace',
    'raisedBedField.plantReplaceSort',
    'raisedBedField.plantSchedule',
    'raisedBedField.plantUpdate',
] as const;

function readAccountId(argv: string[]) {
    const option = argv.find((argument) =>
        argument.startsWith('--account-id='),
    );
    const accountId = option?.slice('--account-id='.length).trim();
    if (!accountId) {
        throw new Error('--account-id is required.');
    }
    return accountId;
}

async function getAccountAggregateIds(accountId: string) {
    const fields = await storage()
        .select({
            positionIndex: raisedBedFields.positionIndex,
            raisedBedId: raisedBedFields.raisedBedId,
        })
        .from(raisedBedFields)
        .innerJoin(raisedBeds, eq(raisedBeds.id, raisedBedFields.raisedBedId))
        .where(
            and(
                eq(raisedBeds.accountId, accountId),
                eq(raisedBeds.isDeleted, false),
                eq(raisedBedFields.isDeleted, false),
            ),
        );

    return [
        ...new Set(
            fields.map(
                (field) =>
                    `${field.raisedBedId.toString()}|${field.positionIndex.toString()}`,
            ),
        ),
    ];
}

async function getPlantCycleEvents(aggregateIds: string[]) {
    if (aggregateIds.length === 0) {
        return [];
    }

    return storage()
        .select({
            aggregateId: events.aggregateId,
            createdAt: events.createdAt,
            data: events.data,
            id: events.id,
            type: events.type,
        })
        .from(events)
        .where(
            and(
                inArray(events.aggregateId, aggregateIds),
                inArray(events.type, [...plantCycleEventTypes]),
            ),
        )
        .orderBy(asc(events.createdAt), asc(events.id));
}

async function getRepairPlan(accountId: string) {
    const aggregateIds = await getAccountAggregateIds(accountId);
    const plantCycleEvents = await getPlantCycleEvents(aggregateIds);
    return planSupersededPlantCycleRepairs(plantCycleEvents);
}

const execute = process.argv.includes('--execute');
const accountId = readAccountId(process.argv.slice(2));

try {
    const plan = await getRepairPlan(accountId);
    console.log(
        JSON.stringify(
            {
                accountId,
                mode: execute ? 'execute' : 'dry-run',
                repairs: plan.repairs,
                unsafe: plan.unsafe,
            },
            null,
            2,
        ),
    );

    if (plan.unsafe.length > 0) {
        throw new Error(
            'Unsafe superseded plant-cycle repairs require review.',
        );
    }

    if (execute && plan.repairs.length > 0) {
        const database = storage();
        await database.transaction(async (transaction) => {
            for (const repair of plan.repairs) {
                await acquirePlantingScheduleTaskLock(
                    transaction,
                    repair.raisedBedId,
                    repair.positionIndex,
                );

                const currentEvents: PlantCycleRepairEvent[] = await transaction
                    .select({
                        aggregateId: events.aggregateId,
                        createdAt: events.createdAt,
                        data: events.data,
                        id: events.id,
                        type: events.type,
                    })
                    .from(events)
                    .where(
                        and(
                            eq(events.aggregateId, repair.aggregateId),
                            inArray(events.type, [...plantCycleEventTypes]),
                        ),
                    )
                    .orderBy(asc(events.createdAt), asc(events.id));
                const currentPlan =
                    planSupersededPlantCycleRepairs(currentEvents);
                const currentRepair = currentPlan.repairs.find(
                    (candidate) => candidate.repairKey === repair.repairKey,
                );
                if (!currentRepair) {
                    continue;
                }
                if (currentPlan.unsafe.length > 0) {
                    throw new Error(
                        `Repair became unsafe for ${repair.aggregateId}.`,
                    );
                }

                await transaction.insert(events).values({
                    aggregateId: repair.aggregateId,
                    createdAt: currentRepair.repairCreatedAt,
                    data: {
                        effectiveDate: new Date(
                            currentRepair.repairCreatedAt.getTime() + 1,
                        ).toISOString(),
                        repairKey: currentRepair.repairKey,
                        repairKind: 'superseded_plant_cycle',
                        status: 'removed',
                        supersededByPlantPlaceEventId:
                            currentRepair.nextPlantPlaceEventId,
                        supersededPlantPlaceEventId:
                            currentRepair.supersededPlantPlaceEventId,
                    },
                    type: 'raisedBedField.plantUpdate',
                    version: 1,
                });
            }
        });
        await bustScheduleCache();

        const verification = await getRepairPlan(accountId);
        if (verification.repairs.length > 0 || verification.unsafe.length > 0) {
            throw new Error(
                'Superseded plant-cycle repair verification failed.',
            );
        }
        console.log(
            `Repaired and verified ${plan.repairs.length.toString()} superseded plant cycles.`,
        );
    }
} finally {
    await closeStorage();
}
