import 'server-only';
import { createHash } from 'node:crypto';
import {
    getHarvestDayKey,
    HARVEST_LABEL_FIELD_LIMIT,
} from '@gredice/js/harvests';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { EntityStandardized } from '../@types/EntityStandardized';
import {
    events,
    gardens,
    harvestTraceLinks,
    operations,
    raisedBedFields,
    raisedBeds,
} from '../schema';
import { storage } from '../storage';
import { getEntitiesFormatted } from './entitiesRepo';
import { knownEvents, knownEventTypes } from './events';
import {
    buildHarvestTracePublicPath,
    normalizeHarvestTraceToken,
} from './harvestTraceLinksRepo';

const groupPayloadSchema = z.object({
    traceLinkIds: z
        .array(z.number().int().positive())
        .min(2)
        .max(HARVEST_LABEL_FIELD_LIMIT)
        .refine((ids) => new Set(ids).size === ids.length),
    fieldLabel: z.string().regex(/^[1-9]\d*-[1-9]\d*$/),
});

async function getGroupCandidates(traceLinkIds: number[]) {
    return storage()
        .select({
            id: harvestTraceLinks.id,
            publicToken: harvestTraceLinks.publicToken,
            status: harvestTraceLinks.status,
            accountId: harvestTraceLinks.accountId,
            gardenId: harvestTraceLinks.gardenId,
            plantSortId: harvestTraceLinks.plantSortId,
            plantingId: harvestTraceLinks.plantingId,
            fieldLabel: harvestTraceLinks.fieldLabel,
            raisedBedPhysicalId: raisedBeds.physicalId,
            operationEntityId: operations.entityId,
            scheduledAt: operations.timestamp,
        })
        .from(harvestTraceLinks)
        .innerJoin(gardens, eq(gardens.id, harvestTraceLinks.gardenId))
        .innerJoin(raisedBeds, eq(raisedBeds.id, harvestTraceLinks.raisedBedId))
        .innerJoin(
            raisedBedFields,
            eq(raisedBedFields.id, harvestTraceLinks.raisedBedFieldId),
        )
        .innerJoin(
            operations,
            eq(operations.id, harvestTraceLinks.harvestOperationId),
        )
        .where(
            and(
                inArray(harvestTraceLinks.id, traceLinkIds),
                eq(operations.isDeleted, false),
                eq(gardens.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(raisedBedFields.isDeleted, false),
            ),
        );
}

/** Membership is immutable so a previously printed QR always refers to the same crops. */
export async function createOrGetHarvestTraceGroup(traceLinkIds: number[]) {
    if (
        traceLinkIds.length < 2 ||
        traceLinkIds.length > HARVEST_LABEL_FIELD_LIMIT ||
        traceLinkIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(traceLinkIds).size !== traceLinkIds.length
    ) {
        throw new Error('Harvest trace groups require 2-9 distinct fields.');
    }
    const candidates = (await getGroupCandidates(traceLinkIds)).sort(
        (a, b) => Number(a.fieldLabel) - Number(b.fieldLabel),
    );
    const first = candidates.at(0);
    if (
        !first ||
        candidates.length !== traceLinkIds.length ||
        !first.raisedBedPhysicalId ||
        first.plantSortId === null ||
        candidates.some(
            (member, index) =>
                member.status !== 'active' ||
                member.plantingId !== null ||
                !/^[1-9]\d*$/.test(member.fieldLabel) ||
                Number(member.fieldLabel) !==
                    Number(first.fieldLabel) + index ||
                member.accountId !== first.accountId ||
                member.gardenId !== first.gardenId ||
                member.raisedBedPhysicalId !== first.raisedBedPhysicalId ||
                member.plantSortId !== first.plantSortId ||
                member.operationEntityId !== first.operationEntityId ||
                getHarvestDayKey(member.scheduledAt) !==
                    getHarvestDayKey(first.scheduledAt),
        )
    ) {
        throw new Error(
            'Harvest trace groups require consecutive fields of the same harvest and plant sort.',
        );
    }
    // Existing random public tokens keep this deterministic group alias opaque.
    const publicToken = createHash('sha256')
        .update('harvest-trace-group:v1:')
        .update(
            candidates
                .toSorted((a, b) => a.id - b.id)
                .map((member) => member.publicToken)
                .join(','),
        )
        .digest()
        .subarray(0, 18)
        .toString('base64url');
    const fieldLabel = `${first.fieldLabel}-${candidates.at(-1)?.fieldLabel}`;
    return storage().transaction(async (tx) => {
        // Serialize creation on the first member so concurrent previews append one event.
        await tx
            .select({ id: harvestTraceLinks.id })
            .from(harvestTraceLinks)
            .where(inArray(harvestTraceLinks.id, traceLinkIds))
            .orderBy(asc(harvestTraceLinks.id))
            .limit(1)
            .for('update');
        const existing = await tx.query.events.findFirst({
            where: and(
                eq(events.type, knownEventTypes.harvestTraceGroups.create),
                eq(events.aggregateId, publicToken),
                eq(events.version, 1),
            ),
        });
        if (!existing)
            await tx.insert(events).values(
                knownEvents.harvestTraceGroups.createdV1(publicToken, {
                    traceLinkIds: candidates.map((member) => member.id),
                    fieldLabel,
                }),
            );
        return { publicToken, fieldLabel };
    });
}

export async function getPublicHarvestTraceGroupByToken(tokenValue: string) {
    const token = normalizeHarvestTraceToken(tokenValue);
    if (!token) return null;
    const group = await storage().query.events.findFirst({
        where: and(
            eq(events.type, knownEventTypes.harvestTraceGroups.create),
            eq(events.aggregateId, token),
            eq(events.version, 1),
        ),
    });
    if (!group) return null;
    const payload = groupPayloadSchema.safeParse(group.data);
    if (!payload.success) return null;
    const candidates = (await getGroupCandidates(payload.data.traceLinkIds))
        .filter((member) => member.status === 'active')
        .sort((a, b) => Number(a.fieldLabel) - Number(b.fieldLabel));
    const first = candidates.at(0);
    if (!first) return null;
    const [plantSorts, operationEntities] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);
    return {
        fieldLabel: payload.data.fieldLabel,
        raisedBedPhysicalId: first.raisedBedPhysicalId,
        plantSortName:
            plantSorts.find((entity) => entity.id === first.plantSortId)
                ?.information?.name ?? 'Ubrana biljka',
        harvestLabel:
            operationEntities.find(
                (entity) => entity.id === first.operationEntityId,
            )?.information?.label ?? 'Berba',
        fields: candidates.map((member) => ({
            fieldLabel: member.fieldLabel,
            publicPath: buildHarvestTracePublicPath(member.publicToken),
        })),
    };
}
