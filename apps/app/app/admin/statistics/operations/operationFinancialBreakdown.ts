export type OperationFinancialOccurrence = {
    key: string;
    label: string;
    durationMinutes: number;
    farmerCost: number | null;
    materialCost: number;
    userCost: number | null;
};

export type OperationFinancialBreakdownRow = {
    key: string;
    label: string;
    taskCount: number;
    totalDurationMinutes: number;
    farmerCost: number;
    materialCost: number;
    userCost: number;
    estimatedEarnings: number;
    missingFarmerPriceCount: number;
    missingUserPriceCount: number;
    incompleteEarningsCount: number;
};

export type OperationFinancialBreakdown = {
    rows: OperationFinancialBreakdownRow[];
    totals: Omit<OperationFinancialBreakdownRow, 'key' | 'label'>;
};

type MutableOperationFinancialBreakdownRow = Omit<
    OperationFinancialBreakdownRow,
    'farmerCost' | 'materialCost' | 'userCost' | 'estimatedEarnings'
> & {
    farmerCostCents: number;
    materialCostCents: number;
    userCostCents: number;
    estimatedEarningsCents: number;
};

function moneyToCents(value: number) {
    return Math.round(value * 100);
}

function centsToMoney(value: number) {
    return value / 100;
}

export function resolveOperationUserCost({
    checkoutProvenanceRecordedFrom,
    hasCheckoutProvenance,
    isInternal,
    operationCreatedAt,
    userPrice,
}: {
    checkoutProvenanceRecordedFrom: Date;
    hasCheckoutProvenance: boolean;
    isInternal: boolean;
    operationCreatedAt: Date;
    userPrice: number | null;
}) {
    const predatesCheckoutProvenance =
        operationCreatedAt < checkoutProvenanceRecordedFrom;

    if (isInternal || (!hasCheckoutProvenance && !predatesCheckoutProvenance)) {
        return 0;
    }

    return userPrice && userPrice > 0 ? userPrice : null;
}

function finalizeRow(
    row: MutableOperationFinancialBreakdownRow,
): OperationFinancialBreakdownRow {
    return {
        key: row.key,
        label: row.label,
        taskCount: row.taskCount,
        totalDurationMinutes: row.totalDurationMinutes,
        farmerCost: centsToMoney(row.farmerCostCents),
        materialCost: centsToMoney(row.materialCostCents),
        userCost: centsToMoney(row.userCostCents),
        estimatedEarnings: centsToMoney(row.estimatedEarningsCents),
        missingFarmerPriceCount: row.missingFarmerPriceCount,
        missingUserPriceCount: row.missingUserPriceCount,
        incompleteEarningsCount: row.incompleteEarningsCount,
    };
}

export function buildOperationFinancialBreakdown(
    occurrences: OperationFinancialOccurrence[],
): OperationFinancialBreakdown {
    const rowsByKey = new Map<string, MutableOperationFinancialBreakdownRow>();

    for (const occurrence of occurrences) {
        const row = rowsByKey.get(occurrence.key) ?? {
            key: occurrence.key,
            label: occurrence.label,
            taskCount: 0,
            totalDurationMinutes: 0,
            farmerCostCents: 0,
            materialCostCents: 0,
            userCostCents: 0,
            estimatedEarningsCents: 0,
            missingFarmerPriceCount: 0,
            missingUserPriceCount: 0,
            incompleteEarningsCount: 0,
        };

        row.taskCount += 1;
        row.totalDurationMinutes += Math.max(0, occurrence.durationMinutes);

        if (occurrence.farmerCost === null) {
            row.missingFarmerPriceCount += 1;
        } else {
            row.farmerCostCents += moneyToCents(occurrence.farmerCost);
        }

        row.materialCostCents += moneyToCents(
            Math.max(0, occurrence.materialCost),
        );

        if (occurrence.userCost === null) {
            row.missingUserPriceCount += 1;
        } else {
            row.userCostCents += moneyToCents(occurrence.userCost);
        }

        if (occurrence.farmerCost === null || occurrence.userCost === null) {
            row.incompleteEarningsCount += 1;
        } else {
            row.estimatedEarningsCents +=
                moneyToCents(occurrence.userCost) -
                moneyToCents(occurrence.farmerCost) -
                moneyToCents(Math.max(0, occurrence.materialCost));
        }

        rowsByKey.set(occurrence.key, row);
    }

    const rows = Array.from(rowsByKey.values())
        .map(finalizeRow)
        .sort((left, right) =>
            left.label.localeCompare(right.label, 'hr-HR', { numeric: true }),
        );
    const totals = rows.reduce<OperationFinancialBreakdown['totals']>(
        (result, row) => ({
            taskCount: result.taskCount + row.taskCount,
            totalDurationMinutes:
                result.totalDurationMinutes + row.totalDurationMinutes,
            farmerCost: centsToMoney(
                moneyToCents(result.farmerCost) + moneyToCents(row.farmerCost),
            ),
            materialCost: centsToMoney(
                moneyToCents(result.materialCost) +
                    moneyToCents(row.materialCost),
            ),
            userCost: centsToMoney(
                moneyToCents(result.userCost) + moneyToCents(row.userCost),
            ),
            estimatedEarnings: centsToMoney(
                moneyToCents(result.estimatedEarnings) +
                    moneyToCents(row.estimatedEarnings),
            ),
            missingFarmerPriceCount:
                result.missingFarmerPriceCount + row.missingFarmerPriceCount,
            missingUserPriceCount:
                result.missingUserPriceCount + row.missingUserPriceCount,
            incompleteEarningsCount:
                result.incompleteEarningsCount + row.incompleteEarningsCount,
        }),
        {
            taskCount: 0,
            totalDurationMinutes: 0,
            farmerCost: 0,
            materialCost: 0,
            userCost: 0,
            estimatedEarnings: 0,
            missingFarmerPriceCount: 0,
            missingUserPriceCount: 0,
            incompleteEarningsCount: 0,
        },
    );

    return { rows, totals };
}
