export type OperationCartTarget = {
    raisedBedId?: number;
    positionIndex?: number;
};

export function assertOperationCartTarget(
    application: string | undefined,
    target: OperationCartTarget,
) {
    switch (application) {
        case 'raisedBedFull':
        case 'raisedBed1m':
            if (!target.raisedBedId) {
                throw new Error('Raised-bed operation requires a raised bed');
            }
            if (typeof target.positionIndex === 'number') {
                throw new Error(
                    'Raised-bed operation cannot target an individual field',
                );
            }
            return;
        case 'plant':
            if (!target.raisedBedId) {
                throw new Error('Plant operation requires a raised bed');
            }
            if (typeof target.positionIndex !== 'number') {
                throw new Error('Plant operation requires a raised-bed field');
            }
            return;
        default:
            throw new Error('Operation is not orderable for this target');
    }
}
