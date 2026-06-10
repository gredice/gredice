import type { OperationVisualReward } from '../../operationVisualRewards';

type RaisedBedPhotographyFieldInput = {
    active?: boolean | null;
    id: number | string;
    positionIndex: number;
};

export type RaisedBedPhotographyMarker = {
    imageCount: number;
    positionIndex: number;
    scope: 'field' | 'raisedBed';
    timestampMs: number;
};

type ResolveRaisedBedPhotographyMarkersInput = {
    blockOffset: number;
    fields: RaisedBedPhotographyFieldInput[];
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

function isActivePhotographyReward(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        reward.family === 'photography' &&
        reward.imageUrls.length > 0 &&
        reward.raisedBedId === raisedBedId
    );
}

export function resolveRaisedBedPhotographyMarkers({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedPhotographyMarkersInput): RaisedBedPhotographyMarker[] {
    const markers: RaisedBedPhotographyMarker[] = [];
    const raisedBedReward = visualRewards.find(
        (reward) =>
            isActivePhotographyReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );

    if (raisedBedReward) {
        markers.push({
            imageCount: raisedBedReward.imageUrls.length,
            positionIndex: 4,
            scope: 'raisedBed',
            timestampMs: raisedBedReward.timestampMs,
        });
    }

    const fieldRewardsByFieldId = new Map<number, OperationVisualReward>();
    for (const reward of visualRewards) {
        if (
            !isActivePhotographyReward(reward, raisedBedId) ||
            reward.scope !== 'field' ||
            reward.raisedBedFieldId == null
        ) {
            continue;
        }

        fieldRewardsByFieldId.set(reward.raisedBedFieldId, reward);
    }

    for (const field of fields) {
        if (
            field.active === false ||
            typeof field.id !== 'number' ||
            field.positionIndex < blockOffset ||
            field.positionIndex >= blockOffset + 9
        ) {
            continue;
        }

        const reward = fieldRewardsByFieldId.get(field.id);
        if (!reward) {
            continue;
        }

        markers.push({
            imageCount: reward.imageUrls.length,
            positionIndex: field.positionIndex - blockOffset,
            scope: 'field',
            timestampMs: reward.timestampMs,
        });
    }

    return markers.sort((a, b) => {
        if (a.positionIndex !== b.positionIndex) {
            return a.positionIndex - b.positionIndex;
        }

        return b.timestampMs - a.timestampMs;
    });
}
