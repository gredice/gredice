export type GardenStructureMutationOutcome = 'rejected' | 'unknown';

export type GardenStructureRolloutGateErrorCode =
    | 'BUILDING_COMMERCIAL_DISABLED'
    | 'BUILDING_SYSTEM_DISABLED';

export function isGardenStructureRolloutGateErrorCode(
    code: string,
): code is GardenStructureRolloutGateErrorCode {
    return (
        code === 'BUILDING_COMMERCIAL_DISABLED' ||
        code === 'BUILDING_SYSTEM_DISABLED'
    );
}

export function getGardenStructureRolloutGateErrorMessage(code: string) {
    switch (code) {
        case 'BUILDING_COMMERCIAL_DISABLED':
            return 'Kupnja, promjena tlocrta i rušenje građevina privremeno su nedostupni. Provjerite status lokalne kopije prije izlaska.';
        case 'BUILDING_SYSTEM_DISABLED':
            return 'Gradnja je privremeno nedostupna. Provjerite status lokalne kopije prije izlaska.';
        default:
            return null;
    }
}

export function classifyGardenStructureMutationHttpOutcome(
    status: number,
    code?: string,
): GardenStructureMutationOutcome {
    if (code && isGardenStructureRolloutGateErrorCode(code)) {
        return 'rejected';
    }

    return status === 0 ||
        status === 408 ||
        status === 425 ||
        status === 429 ||
        status >= 500
        ? 'unknown'
        : 'rejected';
}
