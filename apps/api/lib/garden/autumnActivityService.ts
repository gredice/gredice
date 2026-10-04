import { getAutumnActivityEventStatus } from '@gredice/js/autumnActivities';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    GardenPackConflictError,
    type GardenPackTransaction,
    grantAutumnActivityReward,
    isGardenPackLifecycleStorageReady,
    isGardenPackPlacementStorageReady,
    isGardenPackStorageReady,
    readAutumnActivityEvent,
    recordAutumnActivityEvent,
    replayAutumnActivityEvent,
    withAccountDeletionFenceTransaction,
} from '@gredice/storage';
import {
    type AutumnActivityActionBody,
    type AutumnActivityCampaign,
    type AutumnActivityProgress,
    type AutumnActivityReceipt,
    type AutumnActivityState,
    autumnActivityActionBodySchema,
    autumnActivityReceiptSchema,
    autumnActivityStateSchema,
} from '@gredice/storage/autumnActivityContract';
import { getBlockData } from '../blocks/blockDataService';
import {
    assertAutumnActivityCampaignIdentity,
    assertAutumnActivityRewardDirectory,
    getAutumnActivityCampaign,
    isAutumnActivityEnabled,
} from './autumnActivityCampaign';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import { isGardenPackStorageEnabled } from './gardenPackRollout';

const emptyProgress = (): AutumnActivityProgress => ({
    discoveredMotifIds: [],
    completed: false,
    welcomePurchaseId: null,
    completionPurchaseId: null,
});
export const autumnActivityDependencies = {
    enabled: isAutumnActivityEnabled,
    packEnabled: isGardenPackStorageEnabled,
    ready: async () =>
        (await isGardenPackStorageReady()) &&
        (await isGardenPackPlacementStorageReady()) &&
        (await isGardenPackLifecycleStorageReady()),
    campaign: getAutumnActivityCampaign,
    blocks: getBlockData,
    now: () => new Date(),
    withAccountTransaction: <T>(
        accountId: string,
        callback: (tx: GardenPackTransaction) => Promise<T>,
    ) => withAccountDeletionFenceTransaction(accountId, callback),
    read: readAutumnActivityEvent,
    grant: grantAutumnActivityReward,
    record: recordAutumnActivityEvent,
};
export type AutumnActivityDependencies = typeof autumnActivityDependencies;
class ActivityFailure extends Error {
    constructor(
        readonly code: string,
        readonly status: 400 | 404 | 409 | 503,
        message: string,
    ) {
        super(message);
    }
}
function fail(
    code: string,
    status: 400 | 404 | 409 | 503,
    message: string,
): never {
    throw new ActivityFailure(code, status, message);
}
type Result =
    | { ok: true; response: AutumnActivityReceipt & { replayed: boolean } }
    | { ok: false; code: string; error: string; status: 400 | 404 | 409 | 503 };

async function prepare(dependencies: AutumnActivityDependencies) {
    if (!dependencies.enabled())
        return { readiness: 'disabled', campaign: null } satisfies {
            readiness: AutumnActivityState['readiness'];
            campaign: AutumnActivityCampaign | null;
        };
    const campaign = await dependencies.campaign();
    if (!campaign)
        return { readiness: 'not-configured', campaign } satisfies {
            readiness: AutumnActivityState['readiness'];
            campaign: AutumnActivityCampaign | null;
        };
    assertAutumnActivityCampaignIdentity(campaign);
    if (!dependencies.packEnabled() || !(await dependencies.ready()))
        return { readiness: 'storage-unavailable', campaign } satisfies {
            readiness: AutumnActivityState['readiness'];
            campaign: AutumnActivityCampaign | null;
        };
    const directory = await settleGardenEconomicMutationDependency(
        dependencies.blocks,
    );
    if (directory.status === 'rejected')
        return { readiness: 'catalogue-unavailable', campaign } satisfies {
            readiness: AutumnActivityState['readiness'];
            campaign: AutumnActivityCampaign | null;
        };
    try {
        assertAutumnActivityRewardDirectory(campaign, directory.value);
    } catch {
        return { readiness: 'reward-unavailable', campaign } satisfies {
            readiness: AutumnActivityState['readiness'];
            campaign: AutumnActivityCampaign | null;
        };
    }
    return { readiness: 'ready', campaign } satisfies {
        readiness: AutumnActivityState['readiness'];
        campaign: AutumnActivityCampaign | null;
    };
}
export function createAutumnActivityService(
    dependencies: AutumnActivityDependencies,
) {
    return {
        async getState(accountId: string): Promise<AutumnActivityState> {
            const preparation = await settleGardenEconomicMutationDependency(
                () => prepare(dependencies),
            );
            const prepared =
                preparation.status === 'fulfilled'
                    ? preparation.value
                    : ({
                          readiness: 'catalogue-unavailable',
                          campaign: null,
                      } satisfies {
                          readiness: AutumnActivityState['readiness'];
                          campaign: AutumnActivityCampaign | null;
                      });
            const stored = await dependencies.read(
                accountId,
                prepared.campaign ? { campaignId: prepared.campaign.id } : {},
            );
            const campaign = prepared.campaign ?? stored?.campaign ?? null;
            const eventStatus = campaign
                ? getAutumnActivityEventStatus(campaign, dependencies.now())
                : null;
            return autumnActivityStateSchema.parse({
                enabled: dependencies.enabled(),
                accountId,
                campaign,
                progress:
                    stored?.receipt.progress ??
                    (campaign ? emptyProgress() : null),
                eventStatus,
                readiness: prepared.readiness,
                actionAvailable:
                    prepared.readiness === 'ready' && eventStatus === 'active',
            });
        },
        async act(
            accountId: string,
            input: AutumnActivityActionBody,
        ): Promise<Result> {
            try {
                const parsed = autumnActivityActionBodySchema.safeParse(input);
                if (!parsed.success)
                    fail(
                        'INVALID_ACTIVITY_ACTION',
                        400,
                        'Neispravan zahtjev za jesenski album.',
                    );
                const command = parsed.data;
                if (command.expectedAccountId !== accountId)
                    fail(
                        'EXPECTED_ACCOUNT_MISMATCH',
                        409,
                        'Račun se promijenio. Vrati se na račun za ovaj zahtjev.',
                    );
                const existing = await dependencies.read(accountId, {
                    operationId: command.operationId,
                });
                // Shared directory readers may acquire a different pool connection. Never hold the account lock while preparing them.
                const preparation = existing
                    ? undefined
                    : await settleGardenEconomicMutationDependency(() =>
                          prepare(dependencies),
                      );
                return await dependencies.withAccountTransaction(
                    accountId,
                    async (tx) => {
                        const replay = await dependencies.read(
                            accountId,
                            { operationId: command.operationId },
                            tx,
                        );
                        if (replay)
                            return {
                                ok: true,
                                response: replayAutumnActivityEvent(
                                    accountId,
                                    command,
                                    replay,
                                ),
                            };
                        if (!dependencies.enabled())
                            fail(
                                'ACTIVITY_DISABLED',
                                503,
                                'Jesenski album trenutačno nije dostupan.',
                            );
                        if (!preparation || preparation.status === 'rejected')
                            fail(
                                'ACTIVITY_UNAVAILABLE',
                                503,
                                'Jesenski album trenutačno nije moguće učitati.',
                            );
                        const prepared = preparation.value;
                        if (
                            prepared.readiness !== 'ready' ||
                            !prepared.campaign ||
                            !dependencies.packEnabled()
                        )
                            fail(
                                'ACTIVITY_NOT_READY',
                                503,
                                'Jesenski album trenutačno nije spreman.',
                            );
                        const campaign = prepared.campaign;
                        if (
                            campaign.id !== command.campaignId ||
                            campaign.versionId !== command.campaignVersionId
                        )
                            fail(
                                'STALE_ACTIVITY',
                                409,
                                'Pravila albuma promijenila su se. Osvježi album.',
                            );
                        if (
                            getAutumnActivityEventStatus(
                                campaign,
                                dependencies.now(),
                            ) !== 'active'
                        )
                            fail(
                                'ACTIVITY_NOT_ACTIVE',
                                409,
                                'Prikupljanje motiva nije otvoreno. Tvoji ukrasi ostaju tvoji.',
                            );
                        const previous = await dependencies.read(
                            accountId,
                            { campaignId: campaign.id },
                            tx,
                        );
                        const progress =
                            previous?.receipt.progress ?? emptyProgress();
                        const granted: AutumnActivityReceipt['granted'] = [];
                        if (command.action.kind === 'discover') {
                            const motifId = command.action.motifId;
                            if (
                                !campaign.motifs.some(
                                    (motif) => motif.id === motifId,
                                )
                            )
                                fail(
                                    'UNKNOWN_MOTIF',
                                    400,
                                    'Motiv nije dio ovog albuma.',
                                );
                            if (!progress.discoveredMotifIds.includes(motifId))
                                progress.discoveredMotifIds.push(motifId);
                            // Canonical order makes multiple-tab discovery and stable response verification straightforward.
                            progress.discoveredMotifIds = campaign.motifs
                                .filter((motif) =>
                                    progress.discoveredMotifIds.includes(
                                        motif.id,
                                    ),
                                )
                                .map((motif) => motif.id);
                            if (
                                progress.discoveredMotifIds.length ===
                                    campaign.motifs.length &&
                                !progress.completionPurchaseId
                            ) {
                                const grant = await dependencies.grant(
                                    accountId,
                                    campaign,
                                    'completion',
                                    tx,
                                );
                                progress.completionPurchaseId =
                                    grant.purchaseId;
                                progress.completed = true;
                                granted.push({
                                    kind: 'completion',
                                    purchaseId: grant.purchaseId,
                                });
                            }
                        } else if (!progress.welcomePurchaseId) {
                            const grant = await dependencies.grant(
                                accountId,
                                campaign,
                                'welcome',
                                tx,
                            );
                            progress.welcomePurchaseId = grant.purchaseId;
                            granted.push({
                                kind: 'welcome',
                                purchaseId: grant.purchaseId,
                            });
                        }
                        const receipt = autumnActivityReceiptSchema.parse({
                            operationId: command.operationId,
                            accountId,
                            campaignId: campaign.id,
                            campaignVersionId: campaign.versionId,
                            progress,
                            granted,
                            chargedSunflowers: 0,
                        });
                        await dependencies.record(
                            accountId,
                            command,
                            campaign,
                            receipt,
                            tx,
                        );
                        return {
                            ok: true,
                            response: { ...receipt, replayed: false },
                        };
                    },
                );
            } catch (error) {
                if (error instanceof ActivityFailure)
                    return {
                        ok: false,
                        code: error.code,
                        error: error.message,
                        status: error.status,
                    };
                if (error instanceof GardenPackConflictError)
                    return {
                        ok: false,
                        code: 'OPERATION_CONFLICT',
                        error: 'Isti zahtjev već je upotrijebljen za drukčiju radnju.',
                        status: 409,
                    };
                if (error instanceof AccountDeletionInProgressError)
                    return {
                        ok: false,
                        code: 'ACCOUNT_DELETION_IN_PROGRESS',
                        error: 'Račun se briše.',
                        status: 409,
                    };
                if (error instanceof AccountNotFoundError)
                    return {
                        ok: false,
                        code: 'ACCOUNT_NOT_FOUND',
                        error: 'Račun nije pronađen.',
                        status: 404,
                    };
                console.error('Autumn activity action failed atomically', {
                    accountId,
                    operationId: input.operationId,
                    error,
                });
                return {
                    ok: false,
                    code: 'ACTIVITY_FAILED',
                    error: 'Radnju trenutačno nije moguće potvrditi. Pokušaj ponovno istim zahtjevom.',
                    status: 503,
                };
            }
        },
    };
}
export const autumnActivityService = createAutumnActivityService(
    autumnActivityDependencies,
);
