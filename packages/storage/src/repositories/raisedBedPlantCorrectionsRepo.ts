import 'server-only';
import { and, eq } from 'drizzle-orm';
import { entities, raisedBeds, users } from '../schema';
import { createEvent, knownEvents } from './events';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import {
    type ScheduleTaskActor,
    ScheduleTaskSubmissionError,
} from './scheduleTaskSubmissionsRepo';
import { withPlantingScheduleTaskTransaction } from './scheduleTaskTransactionsRepo';

export type LegacyPlantSortCorrectionIdentity = {
    kind: 'legacy';
    raisedBedId: number;
    positionIndex: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
};

export async function correctLegacyRaisedBedPlantSort(
    input: LegacyPlantSortCorrectionIdentity & {
        actor: ScheduleTaskActor;
        plantSortId: number;
    },
) {
    if (input.actor.role !== 'admin') {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Sortu biljke može ispraviti administrator.',
        );
    }
    if (
        ![
            input.plantSortId,
            input.expectedPlantSortId,
            input.expectedPlantCycleEventId,
            input.expectedPlantCycleVersionEventId,
        ].every((value) => Number.isSafeInteger(value) && value > 0)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Podaci o biljci nisu ispravni.',
        );
    }
    return withPlantingScheduleTaskTransaction(
        input.raisedBedId,
        input.positionIndex,
        async (tx) => {
            const [actor] = await tx
                .select({ role: users.role })
                .from(users)
                .where(eq(users.id, input.actor.userId))
                .limit(1)
                .for('share');
            if (actor?.role !== 'admin') {
                throw new ScheduleTaskSubmissionError(
                    'not_authorized',
                    'Sortu biljke može ispraviti administrator.',
                );
            }
            const [bed] = await tx
                .select({ status: raisedBeds.status })
                .from(raisedBeds)
                .where(
                    and(
                        eq(raisedBeds.id, input.raisedBedId),
                        eq(raisedBeds.isDeleted, false),
                    ),
                )
                .limit(1)
                .for('share');
            if (!bed) {
                throw new ScheduleTaskSubmissionError(
                    'not_found',
                    'Gredica nije pronađena.',
                );
            }
            if (bed.status === 'abandoned') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Biljku na napuštenoj gredici nije moguće ispraviti.',
                );
            }
            const field = (
                await getRaisedBedFieldsWithEvents(input.raisedBedId, tx)
            ).find(
                (field) =>
                    field.positionIndex === input.positionIndex && field.active,
            );
            const cycle = field?.plantCycles.find((cycle) => cycle.active);
            if (
                !field ||
                !cycle ||
                cycle.plantPlaceEventId !== input.expectedPlantCycleEventId ||
                cycle.endedEventId !== input.expectedPlantCycleVersionEventId ||
                field.plantSortId !== input.expectedPlantSortId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Biljka se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            const [sort] = await tx
                .select({ type: entities.entityTypeName })
                .from(entities)
                .where(
                    and(
                        eq(entities.id, input.plantSortId),
                        eq(entities.isDeleted, false),
                    ),
                )
                .limit(1);
            if (sort?.type !== 'plantSort') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Odabrana sorta biljke ne postoji.',
                );
            }
            if (input.plantSortId === field.plantSortId)
                return { success: true };
            await createEvent(
                knownEvents.raisedBedFields.plantReplaceSortV1(
                    `${input.raisedBedId}|${input.positionIndex}`,
                    {
                        plantSortId: input.plantSortId.toString(),
                        previousPlantSortId: field.plantSortId,
                        correctedBy: input.actor.userId,
                    },
                ),
                tx,
            );
            return { success: true };
        },
    );
}
