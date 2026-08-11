export const advancedSowingServerFlagName = 'GREDICE_ADVANCED_SOWING_ENABLED';

/**
 * Compile-time readiness guard for the selected planting fulfillment and its
 * single-task lifecycle. Runtime activation still requires the independent,
 * fail-closed server environment flag below.
 */
export const advancedSowingSelectedFulfillmentReady = true;

export function parseAdvancedSowingServerFlag(value: string | undefined) {
    return value?.trim().toLowerCase() === 'true';
}

/**
 * Independent server mutation gate. The Garden flag controls presentation;
 * this gate must also be enabled before cart authorization is wired.
 */
export function isAdvancedSowingServerEnabled() {
    return parseAdvancedSowingServerFlag(
        process.env[advancedSowingServerFlagName],
    );
}
