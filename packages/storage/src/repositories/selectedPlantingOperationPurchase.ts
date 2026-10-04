import 'server-only';
import type { SelectedPlantingOperationTarget } from '@gredice/js/plants';
import { eq } from 'drizzle-orm';
import { entities, raisedBedPlantings, raisedBeds } from '../schema';
import { storage } from '../storage';
import { assertOperationTargetAllowsDefinition } from './operationsRepo';
import { getRaisedBedPlanting } from './raisedBedPlantingsRepo';
import type { ScheduleTaskTransaction } from './scheduleTaskTransactionsRepo';

export async function assertSelectedPlantingOperationPurchase(
    input: {
        target: SelectedPlantingOperationTarget;
        accountId: string;
        gardenId: number;
        raisedBedId: number;
        entityId: number;
    },
    db: ReturnType<typeof storage> | ScheduleTaskTransaction = storage(),
) {
    await db
        .select({ id: raisedBedPlantings.id })
        .from(raisedBedPlantings)
        .where(eq(raisedBedPlantings.id, input.target.plantingId))
        .for('update');
    const planting = await getRaisedBedPlanting(input.target.plantingId, db);
    const bed = await db.query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, input.raisedBedId),
    });
    if (
        !planting ||
        planting.raisedBedId !== input.raisedBedId ||
        bed?.accountId !== input.accountId ||
        bed.gardenId !== input.gardenId ||
        planting.selectedTask?.identity.expectedLifecycleVersionEventId !==
            input.target.expectedLifecycleVersionEventId ||
        planting.plantSortId !== input.target.expectedPlantSortId
    )
        throw new Error(
            'Sadnja se promijenila ili nije dostupna. Osvježi vrt i ponovno odaberi radnju.',
        );
    const entity = await db.query.entities.findFirst({
        where: eq(entities.id, input.entityId),
    });
    if (entity?.state !== 'published' || entity.isDeleted)
        throw new Error('Radnja više nije dostupna.');
    await assertOperationTargetAllowsDefinition(
        {
            plantingId: planting.id,
            raisedBedId: bed.id,
            gardenId: input.gardenId,
            accountId: input.accountId,
            entityId: input.entityId,
            entityTypeName: 'operation',
            raisedBedFieldId: null,
        },
        db,
    );
    if (
        input.entityId === 593 &&
        (planting.selectedTask?.sowingLocation !== 'greenhouse' ||
            planting.lifecycleStatus !== 'sprouted')
    )
        throw new Error(
            'Presađivanje je dostupno samo za proklijalu sadnju u stakleniku.',
        );
}
