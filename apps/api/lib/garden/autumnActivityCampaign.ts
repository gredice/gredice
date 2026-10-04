import 'server-only';
import { createHash } from 'node:crypto';
import type { BlockData } from '@gredice/directory-types';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    type AutumnActivityCampaign,
    autumnActivityCampaignSchema,
} from '@gredice/storage/autumnActivityContract';
import { canonicalGardenPackJson } from './autumnStarterPackPreparation';
import { isGardenPackModelEligible } from './gardenPackEligibility';

function digest(value: unknown) {
    return createHash('sha256')
        .update(canonicalGardenPackJson(value))
        .digest('hex');
}
/** Trusted configuration preflight: every identity includes all immutable content and review bytes. */
export function defineAutumnActivityCampaign(
    input: unknown,
): AutumnActivityCampaign {
    const campaign = autumnActivityCampaignSchema.parse(input);
    for (const kind of ['welcome', 'completion'] satisfies (
        | 'welcome'
        | 'completion'
    )[]) {
        const reward = campaign.rewards[kind];
        const { productVersionId: _version, ...snapshot } = reward.snapshot;
        if (snapshot.productId !== `autumn-reward:${campaign.id}:${kind}`)
            throw new Error(
                'Reward product identity must be stable across campaign versions',
            );
        reward.snapshot.productVersionId = `cosmetic:v1:${digest({ snapshot, review: reward.review })}`;
    }
    const { versionId: _version, ...contents } = campaign;
    campaign.versionId = `autumn-activity:v1:${digest(contents)}`;
    return autumnActivityCampaignSchema.parse(campaign);
}
export function assertAutumnActivityCampaignIdentity(
    campaign: AutumnActivityCampaign,
) {
    if (
        canonicalGardenPackJson(defineAutumnActivityCampaign(campaign)) !==
        canonicalGardenPackJson(campaign)
    )
        throw new Error(
            'Activity definition changed under an immutable version',
        );
}
export function assertAutumnActivityRewardDirectory(
    campaign: AutumnActivityCampaign,
    blocks: readonly BlockData[],
) {
    assertAutumnActivityCampaignIdentity(campaign);
    for (const kind of ['welcome', 'completion'] satisfies (
        | 'welcome'
        | 'completion'
    )[]) {
        const line = campaign.rewards[kind].snapshot.lines[0];
        if (!line) throw new Error('Reward line missing');
        const byId = blocks.filter(
            (block) => block.id.toString() === line.entityId,
        );
        const byName = blocks.filter(
            (block) => block.information.name === line.modelName,
        );
        const block = byId[0];
        if (
            !block ||
            !isGardenPackModelEligible(line.modelName) ||
            !Number.isSafeInteger(block.id) ||
            block.id <= 0 ||
            byId.length !== 1 ||
            byName.length !== 1 ||
            byName[0] !== block ||
            block.entityType?.name !== 'block' ||
            block.attributes?.type !== 'decoration' ||
            block.attributes.spanWidth !== 1 ||
            block.attributes.spanDepth !== 1 ||
            block.attributes.stackable !== false ||
            block.functions?.raisedBed !== false ||
            block.functions?.recycler !== false ||
            resolveGardenPackLineVariant(line) !== null
        )
            throw new Error(
                'Reviewed published static reward identity or footprint is unavailable',
            );
    }
}
/** Bounded private server configuration; never trusts a client-authored campaign. */
export async function getAutumnActivityCampaign(): Promise<AutumnActivityCampaign | null> {
    const value = process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN;
    if (!value) return null;
    if (Buffer.byteLength(value, 'utf8') > 64_000)
        throw new Error('Activity configuration is too large');
    const campaign = autumnActivityCampaignSchema.parse(JSON.parse(value));
    assertAutumnActivityCampaignIdentity(campaign);
    return campaign;
}

/** Offline preparation verifies supplied actual asset bytes; it never writes or activates configuration. */
export function prepareAutumnActivityCampaign(
    input: unknown,
    blocks: readonly BlockData[],
    evidence: Record<
        'welcome' | 'completion',
        { modelBytes: Uint8Array; previewBytes: Uint8Array }
    >,
) {
    const campaign = defineAutumnActivityCampaign(input);
    for (const kind of ['welcome', 'completion'] satisfies (
        | 'welcome'
        | 'completion'
    )[]) {
        const bytes = evidence[kind];
        for (const value of [bytes.modelBytes, bytes.previewBytes])
            if (value.byteLength === 0 || value.byteLength > 10_000_000)
                throw new Error(
                    'Review asset bytes must be bounded and nonempty',
                );
        if (
            createHash('sha256').update(bytes.modelBytes).digest('hex') !==
                campaign.rewards[kind].review.modelSha256 ||
            createHash('sha256').update(bytes.previewBytes).digest('hex') !==
                campaign.rewards[kind].review.previewSha256
        )
            throw new Error(
                'Review digest does not match actual supplied asset bytes',
            );
    }
    assertAutumnActivityRewardDirectory(campaign, blocks);
    return campaign;
}
export function isAutumnActivityEnabled() {
    return process.env.GREDICE_AUTUMN_ACTIVITY_ENABLED === 'true';
}
