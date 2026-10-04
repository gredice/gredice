import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';

export type AnimalProfileCommandRequest = {
    behavior: 'trot';
    sequence: number;
    species: 'Cow';
    targetId?: string | null;
};

const acknowledgedActorIds = new Set<string>();
const movingActorIds = new Set<string>();
let request: AnimalProfileCommandRequest | null = null;

export function readAnimalProfileCommandMetrics() {
    const acknowledgedIds = Array.from(acknowledgedActorIds).sort(
        (left, right) => left.localeCompare(right),
    );
    const movingIds = Array.from(movingActorIds).sort((left, right) =>
        left.localeCompare(right),
    );

    return {
        profileAnimalCommandAcknowledgedIds: acknowledgedIds,
        profileAnimalCommandAcknowledgementCount: acknowledgedIds.length,
        profileAnimalCommandBehavior: request?.behavior,
        profileAnimalCommandMovingAcknowledgedIds: movingIds,
        profileAnimalCommandMovingAcknowledgementCount: movingIds.length,
        profileAnimalCommandSequence: request?.sequence,
        profileAnimalCommandSpecies: request?.species,
    };
}

function publishAnimalProfileCommandMetrics() {
    updateGameProfileMetadata(readAnimalProfileCommandMetrics());
}

export function resetAnimalProfileCommandMetrics() {
    acknowledgedActorIds.clear();
    movingActorIds.clear();
    request = null;
    publishAnimalProfileCommandMetrics();
}

export function startAnimalProfileCommandMetrics(
    nextRequest: AnimalProfileCommandRequest,
) {
    acknowledgedActorIds.clear();
    movingActorIds.clear();
    request = nextRequest;
    publishAnimalProfileCommandMetrics();
}

export function recordAnimalProfileCommandAcknowledgement({
    actorId,
    behavior,
    moving,
    sequence,
    species,
}: {
    actorId: string;
    behavior: string;
    moving: boolean;
    sequence: number;
    species: string;
}) {
    if (
        !request ||
        request.sequence !== sequence ||
        request.species !== species ||
        request.behavior !== behavior ||
        (request.targetId && request.targetId !== actorId)
    ) {
        return false;
    }

    const acknowledgementWasAdded = !acknowledgedActorIds.has(actorId);
    const movingWasAdded = moving && !movingActorIds.has(actorId);
    acknowledgedActorIds.add(actorId);
    if (moving) {
        movingActorIds.add(actorId);
    }
    if (acknowledgementWasAdded || movingWasAdded) {
        publishAnimalProfileCommandMetrics();
    }
    return true;
}
