import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
    type AutumnActivityActionBody,
    type AutumnActivityCampaign,
    type AutumnActivityReceipt,
    autumnActivityStoredEventSchema,
} from '../autumnActivityContract';
import { events } from '../schema';
import { storage } from '../storage';
import {
    GardenPackConflictError,
    type GardenPackTransaction,
    recordPurchasedGardenPack,
} from './gardenPacksRepo';

export const autumnActivityEventType = 'account.autumnActivity.action';
type Database = ReturnType<typeof storage> | GardenPackTransaction;
export async function readAutumnActivityEvent(
    accountId: string,
    filter: { operationId?: string; campaignId?: string } = {},
    db: Database = storage(),
) {
    const [event] = await db
        .select({ data: events.data })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, autumnActivityEventType),
                eq(events.version, 1),
                filter.operationId
                    ? sql`${events.data}->'command'->>'operationId' = ${filter.operationId}`
                    : undefined,
                filter.campaignId
                    ? sql`${events.data}->'command'->>'campaignId' = ${filter.campaignId}`
                    : undefined,
            ),
        )
        .orderBy(desc(events.id))
        .limit(1);
    return event
        ? autumnActivityStoredEventSchema.parse(event.data)
        : undefined;
}
export function replayAutumnActivityEvent(
    accountId: string,
    command: AutumnActivityActionBody,
    event: NonNullable<Awaited<ReturnType<typeof readAutumnActivityEvent>>>,
) {
    if (
        event.receipt.accountId !== accountId ||
        !isDeepStrictEqual(command, event.command)
    )
        throw new GardenPackConflictError(
            'Activity operation has different contents',
        );
    return { ...event.receipt, replayed: true };
}

/** Internal cosmetic authority: finite zero-value grant, never an economic purchase. */
export async function grantAutumnActivityReward(
    accountId: string,
    campaign: AutumnActivityCampaign,
    kind: 'welcome' | 'completion',
    tx: GardenPackTransaction,
) {
    const parsed =
        autumnActivityStoredEventSchema.shape.campaign.parse(campaign);
    // Stable across definition versions and all client operation UUIDs, including after disposal.
    return recordPurchasedGardenPack(
        accountId,
        `autumn-reward:${parsed.id}:${kind}`,
        parsed.rewards[kind].snapshot,
        tx,
    );
}
export async function recordAutumnActivityEvent(
    accountId: string,
    command: AutumnActivityActionBody,
    campaign: AutumnActivityCampaign,
    receipt: AutumnActivityReceipt,
    tx: GardenPackTransaction,
) {
    const data = autumnActivityStoredEventSchema.parse({
        command,
        campaign,
        receipt,
    });
    if (
        accountId !== command.expectedAccountId ||
        receipt.accountId !== accountId ||
        receipt.operationId !== command.operationId ||
        receipt.campaignId !== command.campaignId ||
        receipt.campaignVersionId !== command.campaignVersionId ||
        campaign.id !== command.campaignId ||
        campaign.versionId !== command.campaignVersionId
    )
        throw new GardenPackConflictError(
            'Activity receipt identity does not match command',
        );
    await tx
        .insert(events)
        .values({
            aggregateId: accountId,
            type: autumnActivityEventType,
            version: 1,
            data,
        });
}
