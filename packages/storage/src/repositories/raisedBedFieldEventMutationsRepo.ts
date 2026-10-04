import 'server-only';

import { and, eq } from 'drizzle-orm';
import {
    events,
    raisedBedFields,
    raisedBedPlantingFields,
    raisedBedPlantings,
} from '../schema';
import { storage } from '../storage';
import { deleteEventById, updateEventCreatedAt } from './events/queries';
import {
    type ScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

export const SELECTED_PLANTING_FIELD_HISTORY_READ_ONLY_MESSAGE =
    'Događaji polja s aktivnom naprednom sjetvom dostupni su samo za čitanje.';

export type RaisedBedFieldEventMutationErrorCode =
    | 'event_not_found'
    | 'invalid_input'
    | 'selected_planting_conflict';

export class RaisedBedFieldEventMutationError extends Error {
    override readonly name = 'RaisedBedFieldEventMutationError';

    constructor(
        readonly code: RaisedBedFieldEventMutationErrorCode,
        message: string,
    ) {
        super(message);
    }
}

function positiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RaisedBedFieldEventMutationError(
            'invalid_input',
            `${label} nije ispravan.`,
        );
    }
    return value;
}

function raisedBedFieldEventPosition(event: {
    aggregateId: string;
    type: string;
}) {
    if (!event.type.startsWith('raisedBedField.')) {
        throw new RaisedBedFieldEventMutationError(
            'invalid_input',
            'Događaj ne pripada polju gredice.',
        );
    }
    const match = /^(\d+)\|(0|[1-9]\d*)$/.exec(event.aggregateId);
    if (!match) {
        throw new RaisedBedFieldEventMutationError(
            'invalid_input',
            'Lokacija događaja polja nije ispravna.',
        );
    }
    const raisedBedId = Number(match[1]);
    const positionIndex = Number(match[2]);
    if (
        !Number.isSafeInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0
    ) {
        throw new RaisedBedFieldEventMutationError(
            'invalid_input',
            'Lokacija događaja polja nije ispravna.',
        );
    }
    return { positionIndex, raisedBedId };
}

async function assertFieldHistoryMutable(
    transaction: ScheduleTaskTransaction,
    raisedBedId: number,
    positionIndex: number,
) {
    const [selectedMembership] = await transaction
        .select({ id: raisedBedPlantingFields.id })
        .from(raisedBedPlantingFields)
        .innerJoin(
            raisedBedPlantings,
            eq(raisedBedPlantingFields.plantingId, raisedBedPlantings.id),
        )
        .innerJoin(
            raisedBedFields,
            eq(raisedBedPlantingFields.raisedBedFieldId, raisedBedFields.id),
        )
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, positionIndex),
                eq(raisedBedFields.isDeleted, false),
                eq(raisedBedPlantingFields.isDeleted, false),
                eq(raisedBedPlantings.configurationSource, 'selected'),
                eq(raisedBedPlantings.isActive, true),
                eq(raisedBedPlantings.isDeleted, false),
            ),
        )
        .limit(1);
    if (selectedMembership) {
        throw new RaisedBedFieldEventMutationError(
            'selected_planting_conflict',
            SELECTED_PLANTING_FIELD_HISTORY_READ_ONLY_MESSAGE,
        );
    }
}

async function mutateRaisedBedFieldEvent<T>(
    eventId: number,
    mutate: (
        event: typeof events.$inferSelect,
        transaction: ScheduleTaskTransaction,
    ) => Promise<T>,
) {
    const validEventId = positiveSafeInteger(eventId, 'ID događaja');
    const event = await storage().query.events.findFirst({
        where: eq(events.id, validEventId),
    });
    if (!event) {
        throw new RaisedBedFieldEventMutationError(
            'event_not_found',
            'Događaj nije pronađen.',
        );
    }
    const target = raisedBedFieldEventPosition(event);

    return withPlantingScheduleTaskTransaction(
        target.raisedBedId,
        target.positionIndex,
        async (transaction) => {
            const [lockedEvent] = await transaction
                .select()
                .from(events)
                .where(eq(events.id, validEventId))
                .limit(1)
                .for('update');
            if (
                !lockedEvent ||
                lockedEvent.type !== event.type ||
                lockedEvent.aggregateId !== event.aggregateId
            ) {
                throw new RaisedBedFieldEventMutationError(
                    'event_not_found',
                    'Događaj više nije dostupan.',
                );
            }

            await assertFieldHistoryMutable(
                transaction,
                target.raisedBedId,
                target.positionIndex,
            );
            return mutate(lockedEvent, transaction);
        },
    );
}

export async function deleteRaisedBedFieldEventById(eventId: number) {
    return mutateRaisedBedFieldEvent(eventId, async (event, transaction) => {
        await deleteEventById(event.id, transaction);
    });
}

export async function updateRaisedBedFieldEventCreatedAt(
    eventId: number,
    createdAt: Date,
) {
    if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
        throw new RaisedBedFieldEventMutationError(
            'invalid_input',
            'Datum događaja nije ispravan.',
        );
    }
    return mutateRaisedBedFieldEvent(eventId, async (event, transaction) => {
        await updateEventCreatedAt(event.id, createdAt, transaction);
    });
}
