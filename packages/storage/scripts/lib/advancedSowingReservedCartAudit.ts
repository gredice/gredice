export type AdvancedSowingReservedCartAuditItem = {
    additionalData: string | null;
};

export type AdvancedSowingReservedCartAudit = {
    clearItemCount: number;
    reservedAdditionalDataItemCount: number;
    reservedKeyCounts: {
        advancedSowing: number;
        advancedSowingAuthorization: number;
    };
    scannedItemCount: number;
    unparseableAdditionalDataItemCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Audits open-cart client data without returning cart, account, or item IDs.
 * Unparseable non-empty JSON blocks activation because it cannot prove that a
 * reserved legacy key is absent.
 */
export function auditAdvancedSowingReservedCartAdditionalData(
    items: readonly AdvancedSowingReservedCartAuditItem[],
): AdvancedSowingReservedCartAudit {
    let clearItemCount = 0;
    let reservedAdditionalDataItemCount = 0;
    let unparseableAdditionalDataItemCount = 0;
    let advancedSowing = 0;
    let advancedSowingAuthorization = 0;

    for (const item of items) {
        if (item.additionalData === null || item.additionalData.trim() === '') {
            clearItemCount += 1;
            continue;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(item.additionalData);
        } catch {
            unparseableAdditionalDataItemCount += 1;
            continue;
        }
        if (!isRecord(parsed)) {
            unparseableAdditionalDataItemCount += 1;
            continue;
        }

        const hasAdvancedSowing = Object.hasOwn(parsed, 'advancedSowing');
        const hasAuthorization = Object.hasOwn(
            parsed,
            'advancedSowingAuthorization',
        );
        if (hasAdvancedSowing) {
            advancedSowing += 1;
        }
        if (hasAuthorization) {
            advancedSowingAuthorization += 1;
        }
        if (hasAdvancedSowing || hasAuthorization) {
            reservedAdditionalDataItemCount += 1;
        } else {
            clearItemCount += 1;
        }
    }

    return {
        clearItemCount,
        reservedAdditionalDataItemCount,
        reservedKeyCounts: {
            advancedSowing,
            advancedSowingAuthorization,
        },
        scannedItemCount: items.length,
        unparseableAdditionalDataItemCount,
    };
}

export function advancedSowingReservedCartAuditPasses(
    audit: AdvancedSowingReservedCartAudit,
) {
    return (
        audit.reservedAdditionalDataItemCount === 0 &&
        audit.unparseableAdditionalDataItemCount === 0
    );
}
