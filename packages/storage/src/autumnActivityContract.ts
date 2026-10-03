import {
    autumnActivityMinimumWindowMs,
    autumnActivityMotifs,
} from '@gredice/js/autumnActivities';
import { z } from 'zod';
import { gardenPackProductSnapshotSchema } from './gardenPackContract';

const id = z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const reward = z.strictObject({
    snapshot: gardenPackProductSnapshotSchema,
    review: z.strictObject({
        versionId: id,
        modelSha256: digest,
        previewSha256: digest,
        previewUrl: z.string().url(),
        spanWidth: z.literal(1),
        spanDepth: z.literal(1),
    }),
});
export const autumnActivityCampaignSchema = z
    .strictObject({
        id,
        versionId: z.string().regex(/^autumn-activity:v1:[a-f0-9]{64}$/),
        name: z.string().min(1).max(200),
        rules: z.array(z.string().min(1).max(2000)).min(1).max(12),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        motifs: z
            .array(
                z.strictObject({
                    id,
                    name: z.string().min(1).max(200),
                    kind: z.enum(['leaf', 'acorn']),
                }),
            )
            .length(6),
        rewards: z.strictObject({ welcome: reward, completion: reward }),
    })
    .superRefine((campaign, context) => {
        if (
            Date.parse(campaign.endsAt) - Date.parse(campaign.startsAt) <
            autumnActivityMinimumWindowMs
        )
            context.addIssue({
                code: 'custom',
                message: 'Activity window must last at least 28 days',
            });
        if (
            campaign.motifs.some(
                (motif, index) =>
                    motif.id !== autumnActivityMotifs[index]?.id ||
                    motif.kind !== autumnActivityMotifs[index]?.kind,
            )
        )
            context.addIssue({
                code: 'custom',
                message: 'Only the six finite album motifs are supported',
            });
        for (const kind of ['welcome', 'completion'] satisfies (
            | 'welcome'
            | 'completion'
        )[]) {
            const configured = campaign.rewards[kind];
            const snapshot = configured.snapshot;
            const line = snapshot.lines[0];
            if (
                snapshot.chargedSunflowers !== 0 ||
                snapshot.lines.length !== 1 ||
                !line ||
                line.quantity !== 1 ||
                line.paidSunflowersByUnit[0] !== 0 ||
                line.recyclingSunflowersByUnit[0] !== 0 ||
                line.variant !== null ||
                line.modelName !==
                    (kind === 'welcome'
                        ? 'WoodlandAcorns'
                        : 'AutumnWreathPost') ||
                snapshot.previews.length !== 1 ||
                snapshot.previews[0] !== configured.review.previewUrl ||
                snapshot.publication !== 'published' ||
                snapshot.availableFrom !== null ||
                snapshot.availableUntil !== null
            )
                context.addIssue({
                    code: 'custom',
                    path: ['rewards', kind],
                    message:
                        'Rewards require exactly one reviewed static zero-value keepsake with retained ownership',
                });
        }
    });
export type AutumnActivityCampaign = z.infer<
    typeof autumnActivityCampaignSchema
>;
export const autumnActivityActionBodySchema = z.strictObject({
    operationId: z.string().uuid(),
    expectedAccountId: z.string().uuid(),
    campaignId: id,
    campaignVersionId: autumnActivityCampaignSchema.shape.versionId,
    action: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('discover'), motifId: id }),
        z.strictObject({ kind: z.literal('claim-welcome') }),
    ]),
});
export type AutumnActivityActionBody = z.infer<
    typeof autumnActivityActionBodySchema
>;
export const autumnActivityProgressSchema = z
    .strictObject({
        discoveredMotifIds: z.array(id).max(6),
        completed: z.boolean(),
        welcomePurchaseId: z.string().uuid().nullable(),
        completionPurchaseId: z.string().uuid().nullable(),
    })
    .superRefine((progress, context) => {
        if (
            new Set(progress.discoveredMotifIds).size !==
                progress.discoveredMotifIds.length ||
            progress.discoveredMotifIds.some(
                (id) => !autumnActivityMotifs.some((motif) => motif.id === id),
            ) ||
            progress.completed !== (progress.completionPurchaseId !== null) ||
            progress.completed !== (progress.discoveredMotifIds.length === 6)
        )
            context.addIssue({
                code: 'custom',
                message: 'Invalid finite activity progress',
            });
    });
export type AutumnActivityProgress = z.infer<
    typeof autumnActivityProgressSchema
>;
export const autumnActivityReceiptSchema = z.strictObject({
    operationId: z.string().uuid(),
    accountId: z.string().uuid(),
    campaignId: id,
    campaignVersionId: autumnActivityCampaignSchema.shape.versionId,
    progress: autumnActivityProgressSchema,
    granted: z
        .array(
            z.strictObject({
                kind: z.enum(['welcome', 'completion']),
                purchaseId: z.string().uuid(),
            }),
        )
        .max(1),
    chargedSunflowers: z.literal(0),
});
export type AutumnActivityReceipt = z.infer<typeof autumnActivityReceiptSchema>;
export const autumnActivityResponseSchema = autumnActivityReceiptSchema.extend({
    replayed: z.boolean(),
});
export const autumnActivityStateSchema = z
    .strictObject({
        enabled: z.boolean(),
        accountId: z.string().uuid(),
        campaign: autumnActivityCampaignSchema.nullable(),
        progress: autumnActivityProgressSchema.nullable(),
        eventStatus: z.enum(['upcoming', 'active', 'ended']).nullable(),
        actionAvailable: z.boolean(),
        readiness: z.enum([
            'ready',
            'disabled',
            'not-configured',
            'storage-unavailable',
            'catalogue-unavailable',
            'reward-unavailable',
        ]),
    })
    .superRefine((state, context) => {
        if (
            (state.campaign === null) !== (state.progress === null) ||
            (state.campaign === null) !== (state.eventStatus === null) ||
            (state.readiness === 'ready' && state.campaign === null) ||
            state.actionAvailable !==
                (state.enabled &&
                    state.readiness === 'ready' &&
                    state.eventStatus === 'active') ||
            (state.readiness === 'disabled' && state.enabled)
        )
            context.addIssue({
                code: 'custom',
                message: 'Contradictory activity state',
            });
    });
export type AutumnActivityState = z.infer<typeof autumnActivityStateSchema>;
export const autumnActivityStoredEventSchema = z
    .strictObject({
        command: autumnActivityActionBodySchema,
        campaign: autumnActivityCampaignSchema,
        receipt: autumnActivityReceiptSchema,
    })
    .superRefine((event, context) => {
        const { command, receipt, campaign } = event;
        if (
            command.operationId !== receipt.operationId ||
            command.expectedAccountId !== receipt.accountId ||
            command.campaignId !== receipt.campaignId ||
            command.campaignVersionId !== receipt.campaignVersionId ||
            campaign.id !== command.campaignId ||
            campaign.versionId !== command.campaignVersionId ||
            receipt.granted.some(
                (grant) =>
                    grant.kind !==
                        (command.action.kind === 'claim-welcome'
                            ? 'welcome'
                            : 'completion') ||
                    grant.purchaseId !==
                        (grant.kind === 'welcome'
                            ? receipt.progress.welcomePurchaseId
                            : receipt.progress.completionPurchaseId),
            )
        )
            context.addIssue({
                code: 'custom',
                message: 'Activity receipt does not match its command',
            });
    });
