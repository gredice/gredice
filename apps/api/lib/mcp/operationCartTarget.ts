export type OperationCartTarget = {
    raisedBedId?: number;
    positionIndex?: number;
};

export function resolveOperationCartTarget(
    application: string | undefined,
    target: OperationCartTarget,
): OperationCartTarget {
    switch (application) {
        case 'raisedBedFull':
        case 'raisedBed1m':
            if (!target.raisedBedId) {
                throw new Error('Raised-bed operation requires a raised bed');
            }
            return { raisedBedId: target.raisedBedId };
        case 'plant':
            if (!target.raisedBedId) {
                throw new Error('Plant operation requires a raised bed');
            }
            if (typeof target.positionIndex !== 'number') {
                throw new Error('Plant operation requires a raised-bed field');
            }
            return {
                raisedBedId: target.raisedBedId,
                positionIndex: target.positionIndex,
            };
        default:
            throw new Error('Operation is not orderable for this target');
    }
}

export function assertOperationCartTarget(
    application: string | undefined,
    target: OperationCartTarget,
) {
    resolveOperationCartTarget(application, target);
}
