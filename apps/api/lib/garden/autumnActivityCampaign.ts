import 'server-only';
import { createHash } from 'node:crypto';
import type { BlockData } from '@gredice/directory-types';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    type AutumnActivityCampaign,
    autumnActivityCampaignSchema,
} from '@gredice/storage/autumnActivityContract';
import { canonicalGardenPackJson } from './autumnStarterPackPreparation';

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
/** No real dates, directory IDs, previews, or campaign activation are invented here. */
export async function getAutumnActivityCampaign(): Promise<AutumnActivityCampaign | null> {
    return null;
}
export function isAutumnActivityEnabled() {
    return process.env.GREDICE_AUTUMN_ACTIVITY_ENABLED === 'true';
}
