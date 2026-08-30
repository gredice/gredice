export type GardenStructureMutationOutcome = 'rejected' | 'unknown';

export function classifyGardenStructureMutationHttpOutcome(
    status: number,
): GardenStructureMutationOutcome {
    return status === 0 ||
        status === 408 ||
        status === 425 ||
        status === 429 ||
        status >= 500
        ? 'unknown'
        : 'rejected';
}
