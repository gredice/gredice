import { knownEventTypes } from '../repositories/events/knownEventTypes';

export function isCanonicalSelectedPlantingSowedEvent(event: {
    type: string;
    data: unknown;
}) {
    return (
        (event.type === knownEventTypes.raisedBedPlantings.taskCompleted ||
            event.type === knownEventTypes.raisedBedPlantings.taskVerified) &&
        typeof event.data === 'object' &&
        event.data !== null &&
        'status' in event.data &&
        event.data.status === 'sowed'
    );
}
