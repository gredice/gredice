import 'server-only';
import { isNotSproutedRefundEligible } from '@gredice/js/plants';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
    projectSelectedRaisedBedPlantingLifecycle,
    selectedRaisedBedPlantingEventTypes,
} from '../helpers/selectedRaisedBedPlantingLifecycle';
import {
    events,
    operationPrices,
    raisedBedPlantings,
    raisedBeds,
} from '../schema';
import type { storage } from '../storage';
import { earnSunflowersOnce } from './accountsRepo';
import { createEvent, knownEventTypes } from './events';
import { createNotification } from './notificationsRepo';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import { getRaisedBedFieldSunflowerRefundAmount } from './shoppingCartRepo';

type DatabaseClient =
    | ReturnType<typeof storage>
    | Parameters<Parameters<ReturnType<typeof storage>['transaction']>[0]>[0];
type TransactionClient = Parameters<
    Parameters<ReturnType<typeof storage>['transaction']>[0]
>[0];

async function refundTarget(
    event: typeof events.$inferSelect,
    db: DatabaseClient,
) {
    if (event.type === knownEventTypes.raisedBedFields.plantUpdate) {
        const [raisedBedId, positionIndex] = event.aggregateId
            .split('|')
            .map(Number);
        if (
            !Number.isSafeInteger(raisedBedId) ||
            !Number.isSafeInteger(positionIndex)
        )
            return;
        const field = (
            await getRaisedBedFieldsWithEvents(raisedBedId, db)
        ).find((field) => field.positionIndex === positionIndex);
        const cycle = field?.plantCycles.find((cycle) =>
            cycle.eventIds.includes(event.id),
        );
        if (!cycle) return;
        return {
            raisedBedId,
            positionIndex,
            key: `legacy:${cycle.plantPlaceEventId}`,
            startedAt: cycle.startedAt,
            sowedAt: cycle.plantSowDate,
            sowingLocation: cycle.sowingLocation,
            purchase: cycle.purchase,
        };
    }
    const planting = await db.query.raisedBedPlantings.findFirst({
        where: and(
            eq(raisedBedPlantings.eventAggregateId, event.aggregateId),
            eq(raisedBedPlantings.configurationSource, 'selected'),
            eq(raisedBedPlantings.isDeleted, false),
        ),
    });
    if (!planting) return;
    const sourceEvents = await db
        .select()
        .from(events)
        .where(
            and(
                eq(events.aggregateId, event.aggregateId),
                inArray(events.type, [...selectedRaisedBedPlantingEventTypes]),
            ),
        )
        .orderBy(asc(events.id));
    const projection = projectSelectedRaisedBedPlantingLifecycle(sourceEvents, {
        aggregateId: planting.eventAggregateId,
        plantingId: planting.id,
        plantSortId: planting.plantSortId,
    });
    return {
        raisedBedId: planting.raisedBedId,
        positionIndex: planting.anchorPositionIndex,
        key: `selected:${planting.id}`,
        startedAt: projection.startedAt,
        sowedAt: projection.statusChanges.find(
            (change) =>
                change.status === 'pendingVerification' ||
                change.status === 'sowed',
        )?.occurredAt,
        sowingLocation: projection.task.initialSowingLocation,
        purchase: projection.task.purchase,
    };
}

/** Runs inside the status event's transaction for every customer/admin/approval writer. */
export async function settleNotSproutedPlanting(
    event: typeof events.$inferSelect,
    db: TransactionClient,
) {
    const target = await refundTarget(event, db);
    if (!target) return;
    const bed = await db.query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, target.raisedBedId),
        with: { garden: true },
    });
    if (!bed?.accountId || !bed.garden || bed.garden.isSandbox) return;
    const data = event.data;
    const effectiveValue =
        typeof data === 'object' && data !== null
            ? 'effectiveDate' in data
                ? data.effectiveDate
                : 'effectiveAt' in data
                  ? data.effectiveAt
                  : undefined
            : undefined;
    const changedAt =
        typeof effectiveValue === 'string'
            ? new Date(effectiveValue)
            : event.createdAt;
    const eligible = isNotSproutedRefundEligible(target.sowedAt, changedAt);
    const settlementKey = `not-sprouted:${target.key}`;
    // Plantings retain this identity when moved to another physical field.
    await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${settlementKey}));`,
    );
    const previous = await db.query.events.findFirst({
        where: and(
            eq(events.type, knownEventTypes.raisedBedFields.notSproutedRefund),
            eq(events.aggregateId, settlementKey),
        ),
    });
    let refundAmount = 0;
    if (eligible && !previous) {
        refundAmount = await getRaisedBedFieldSunflowerRefundAmount({
            accountId: bed.accountId,
            db,
            plantCycleStartedAt: target.startedAt,
            positionIndex: target.positionIndex,
            purchase: target.purchase,
            raisedBedId: target.raisedBedId,
        });
        const sowingType =
            target.sowingLocation === 'greenhouse'
                ? 'sowingGreenhouse'
                : 'sowing';
        const price = await db.query.operationPrices.findFirst({
            where: and(
                eq(operationPrices.farmId, bed.garden.farmId),
                eq(operationPrices.entityTypeName, sowingType),
                sql`${operationPrices.entityId} is null`,
            ),
        });
        const deductionCents = price
            ? Math.round(Number(price.pricePerUnit) * 100 * 0.5)
            : 0;
        if (!Number.isSafeInteger(deductionCents) || deductionCents < 0)
            throw new Error('Invalid sowing payout price.');
        await createEvent(
            {
                type: knownEventTypes.raisedBedFields.notSproutedRefund,
                version: 1,
                aggregateId: settlementKey,
                data: {
                    accountId: bed.accountId,
                    farmId: bed.garden.farmId,
                    sourceEventId: event.id,
                    refundAmount,
                    deductionCents,
                    sowingType,
                    currency: price?.currency ?? 'eur',
                },
            },
            db,
        );
        if (refundAmount > 0)
            await earnSunflowersOnce(
                bed.accountId,
                refundAmount,
                `refund:${settlementKey}`,
                db,
            );
    }
    const refundMessage = previous
        ? 'Povrat za ovu sadnju već je obrađen. Ponovna promjena stanja ne donosi dodatni povrat.'
        : refundAmount > 0
          ? `Puni plaćeni iznos sadnje, ${refundAmount} 🌻, vraćen je na tvoj saldo.`
          : eligible
            ? 'Za ovu sadnju nije evidentiran plaćeni iznos za povrat. Ako nedostaje podatak o plaćanju, javi se podršci.'
            : 'Na odabrani datum nije prošlo najmanje 15 dana od evidentiranog sijanja, pa suncokreti nisu vraćeni.';
    await createNotification(
        {
            accountId: bed.accountId,
            gardenId: bed.gardenId,
            raisedBedId: bed.id,
            header: '😢 Biljka nije proklijala',
            content: `Biljka u gredici **${bed.name}** na poziciji **${target.positionIndex + 1}** nije proklijala.\n${refundMessage}`,
            linkUrl: bed.name
                ? getRaisedBedCloseupUrl(bed.name, {
                      positionIndex: target.positionIndex,
                  })
                : undefined,
            timestamp: new Date(),
        },
        { db, idempotencyKey: `not-sprouted-status:${event.id}` },
    );
}
