import { FIELD_SIZE_CM } from './fieldCalculations';

export const ADVANCED_SOWING_BED_COLUMN_COUNT = 3;
export const ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT = 18;
export const advancedSowingSelectionRequestKind =
    'advanced-sowing-selection' as const;
export const advancedSowingCartAuthorizationKind =
    'advanced-sowing-cart-authorization' as const;
export const advancedSowingSelectionSummaryKind =
    'advanced-sowing-selection-summary' as const;

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
    const keys = Object.keys(value);
    return (
        keys.length === expected.length &&
        keys.every((key) => expected.includes(key))
    );
}

export type AdvancedSowingDistanceRangeInput = {
    optimalDistanceCm: number;
    minDistanceCm?: number | null;
    maxDistanceCm?: number | null;
};

export type AdvancedSowingDistanceRange = {
    optimalDistanceCm: number;
    minDistanceCm: number;
    maxDistanceCm: number;
};

export type AdvancedSowingLayoutInput = AdvancedSowingDistanceRangeInput & {
    selectedDistanceCm?: number | null;
};

export type AdvancedSowingLayoutKey =
    `v1:fields:${number}x${number}:plants:${number}x${number}`;

export type AdvancedSowingLayout = AdvancedSowingDistanceRange & {
    selectedDistanceCm: number;
    fieldSpanRows: number;
    fieldSpanColumns: number;
    footprintFieldCount: number;
    plantsPerAxis: number;
    plantCount: number;
    layoutKey: AdvancedSowingLayoutKey;
};

export type AdvancedSowingLayoutOption = AdvancedSowingLayout & {
    isDefault: boolean;
};

export type AdvancedSowingFootprintInput = {
    anchorPositionIndex: number;
    fieldSpanRows: number;
    fieldSpanColumns: number;
    bedFieldCount?: number;
    bedColumnCount?: number;
};

export type AdvancedSowingBedGeometryInput = {
    bedFieldCount?: number;
    bedColumnCount?: number;
};

export type BuildAdvancedSowingCartConfigurationV1Input =
    AdvancedSowingLayoutInput & {
        anchorPositionIndex: number;
        bedFieldCount: number;
    };

export type AdvancedSowingCartConfigurationV1 = {
    version: 1;
    anchorPositionIndex: number;
    bedFieldCount: number;
    selectedDistanceCm: number;
    optimalDistanceCm: number;
    minDistanceCm: number;
    maxDistanceCm: number;
    layoutKey: AdvancedSowingLayoutKey;
    plantsPerAxis: number;
    plantCount: number;
    fieldSpanRows: number;
    fieldSpanColumns: number;
    occupiedPositionIndices: number[];
};

export type AdvancedSowingSelectionRequestV1 = {
    kind: typeof advancedSowingSelectionRequestKind;
    version: 1;
    selectedDistanceCm: number;
};

export type AdvancedSowingCartAuthorizationV1 = {
    kind: typeof advancedSowingCartAuthorizationKind;
    version: 1;
    plan: AdvancedSowingCartConfigurationV1;
};

export type AdvancedSowingSelectionSummaryV1 = {
    kind: typeof advancedSowingSelectionSummaryKind;
    version: 1;
    selectedDistanceCm: number;
    layoutKey: AdvancedSowingLayoutKey;
    plantCount: number;
    fieldSpanRows: number;
    fieldSpanColumns: number;
    occupiedPositionIndices: number[];
};

export function buildAdvancedSowingSelectionRequestV1(
    selectedDistanceCm: number,
): AdvancedSowingSelectionRequestV1 {
    return parseAdvancedSowingSelectionRequestV1({
        kind: advancedSowingSelectionRequestKind,
        selectedDistanceCm,
        version: 1,
    });
}

const MAX_ADVANCED_SOWING_LAYOUT_OPTIONS = 10_000;

function requireFinitePositiveDistance(value: number, label: string) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${label} must be a finite positive number.`);
    }

    return value;
}

function requirePositiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive safe integer.`);
    }

    return value;
}

export function resolveAdvancedSowingDistanceRange({
    optimalDistanceCm,
    minDistanceCm,
    maxDistanceCm,
}: AdvancedSowingDistanceRangeInput): AdvancedSowingDistanceRange {
    const optimal = requireFinitePositiveDistance(
        optimalDistanceCm,
        'Optimal sowing distance',
    );
    const min = requireFinitePositiveDistance(
        minDistanceCm ?? optimal,
        'Minimum sowing distance',
    );
    const max = requireFinitePositiveDistance(
        maxDistanceCm ?? optimal,
        'Maximum sowing distance',
    );

    if (min > optimal || optimal > max) {
        throw new RangeError(
            'Sowing distances must satisfy min <= optimal <= max.',
        );
    }

    return {
        maxDistanceCm: max,
        minDistanceCm: min,
        optimalDistanceCm: optimal,
    };
}

export function resolveAdvancedSowingLayout({
    selectedDistanceCm,
    ...distanceRangeInput
}: AdvancedSowingLayoutInput): AdvancedSowingLayout {
    const distanceRange =
        resolveAdvancedSowingDistanceRange(distanceRangeInput);
    const selected = requireFinitePositiveDistance(
        selectedDistanceCm ?? distanceRange.optimalDistanceCm,
        'Selected sowing distance',
    );

    if (
        selected < distanceRange.minDistanceCm ||
        selected > distanceRange.maxDistanceCm
    ) {
        throw new RangeError(
            'Selected sowing distance must be within the configured range.',
        );
    }

    const spansMultipleFields = selected > FIELD_SIZE_CM;
    const fieldsPerAxis = spansMultipleFields
        ? Math.ceil(selected / FIELD_SIZE_CM)
        : 1;
    const plantsPerAxis = spansMultipleFields
        ? 1
        : Math.floor(FIELD_SIZE_CM / selected);
    const safeFieldsPerAxis = requirePositiveSafeInteger(
        fieldsPerAxis,
        'Fields per axis',
    );
    const safePlantsPerAxis = requirePositiveSafeInteger(
        plantsPerAxis,
        'Plants per axis',
    );
    const footprintFieldCount = requirePositiveSafeInteger(
        safeFieldsPerAxis * safeFieldsPerAxis,
        'Footprint field count',
    );
    const plantCount = requirePositiveSafeInteger(
        safePlantsPerAxis * safePlantsPerAxis,
        'Plant count',
    );
    const layoutKey: AdvancedSowingLayoutKey = `v1:fields:${safeFieldsPerAxis}x${safeFieldsPerAxis}:plants:${safePlantsPerAxis}x${safePlantsPerAxis}`;

    return {
        ...distanceRange,
        fieldSpanColumns: safeFieldsPerAxis,
        fieldSpanRows: safeFieldsPerAxis,
        footprintFieldCount,
        layoutKey,
        plantCount,
        plantsPerAxis: safePlantsPerAxis,
        selectedDistanceCm: selected,
    };
}

function getDensityLayoutRepresentativeDistance(plantsPerAxis: number) {
    const upperBoundary = FIELD_SIZE_CM / plantsPerAxis;
    if (Math.floor(FIELD_SIZE_CM / upperBoundary) === plantsPerAxis) {
        return upperBoundary;
    }

    return upperBoundary * (1 - Number.EPSILON);
}

function resolveAdvancedSowingBedGeometry({
    bedFieldCount = ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    bedColumnCount = ADVANCED_SOWING_BED_COLUMN_COUNT,
}: AdvancedSowingBedGeometryInput = {}) {
    const safeBedFieldCount = requirePositiveSafeInteger(
        bedFieldCount,
        'Bed field count',
    );
    const safeBedColumnCount = requirePositiveSafeInteger(
        bedColumnCount,
        'Bed column count',
    );
    if (safeBedFieldCount % safeBedColumnCount !== 0) {
        throw new RangeError(
            `Bed field count must be divisible by ${safeBedColumnCount.toString()}.`,
        );
    }

    return {
        bedColumnCount: safeBedColumnCount,
        bedFieldCount: safeBedFieldCount,
        bedRowCount: safeBedFieldCount / safeBedColumnCount,
    };
}

export function advancedSowingLayoutFitsBed(
    layout: Pick<AdvancedSowingLayout, 'fieldSpanColumns' | 'fieldSpanRows'>,
    geometry?: AdvancedSowingBedGeometryInput,
) {
    const { bedColumnCount, bedRowCount } =
        resolveAdvancedSowingBedGeometry(geometry);

    return (
        layout.fieldSpanColumns <= bedColumnCount &&
        layout.fieldSpanRows <= bedRowCount
    );
}

/**
 * Returns one deterministic choice for every distinct layout available in the
 * configured range. The optimal layout wins representative selection when
 * multiple distances resolve to the same layout, followed by min and max.
 */
export function getAdvancedSowingLayoutOptions(
    input: AdvancedSowingDistanceRangeInput,
    geometry?: AdvancedSowingBedGeometryInput,
): AdvancedSowingLayoutOption[] {
    const distanceRange = resolveAdvancedSowingDistanceRange(input);
    const optionsByLayoutKey = new Map<
        AdvancedSowingLayoutKey,
        AdvancedSowingLayoutOption
    >();

    function addOption(selectedDistanceCm: number, isDefault = false) {
        const layout = resolveAdvancedSowingLayout({
            ...distanceRange,
            selectedDistanceCm,
        });
        if (optionsByLayoutKey.has(layout.layoutKey)) {
            return;
        }

        optionsByLayoutKey.set(layout.layoutKey, {
            ...layout,
            isDefault,
        });
    }

    // Priority is intentional: the default must retain the exact optimal
    // distance, while boundary layouts retain min before max when deduplicated.
    addOption(distanceRange.optimalDistanceCm, true);
    addOption(distanceRange.minDistanceCm);
    addOption(distanceRange.maxDistanceCm);

    if (
        Array.from(optionsByLayoutKey.values()).some(
            (option) => !advancedSowingLayoutFitsBed(option, geometry),
        )
    ) {
        throw new RangeError(
            'Advanced Sowing distance range requires a footprint unsupported by the raised bed geometry.',
        );
    }

    let transitionCount = 0;
    if (distanceRange.minDistanceCm <= FIELD_SIZE_CM) {
        const densestLayout = resolveAdvancedSowingLayout({
            ...distanceRange,
            selectedDistanceCm: distanceRange.minDistanceCm,
        });
        const sparsestSingleFieldLayout = resolveAdvancedSowingLayout({
            ...distanceRange,
            selectedDistanceCm: Math.min(
                distanceRange.maxDistanceCm,
                FIELD_SIZE_CM,
            ),
        });
        transitionCount +=
            densestLayout.plantsPerAxis -
            sparsestSingleFieldLayout.plantsPerAxis +
            1;

        if (transitionCount > MAX_ADVANCED_SOWING_LAYOUT_OPTIONS) {
            throw new RangeError(
                'Advanced Sowing range produces too many layout options.',
            );
        }

        for (
            let plantsPerAxis = densestLayout.plantsPerAxis;
            plantsPerAxis >= sparsestSingleFieldLayout.plantsPerAxis;
            plantsPerAxis -= 1
        ) {
            const selectedDistanceCm =
                getDensityLayoutRepresentativeDistance(plantsPerAxis);
            if (
                selectedDistanceCm >= distanceRange.minDistanceCm &&
                selectedDistanceCm <= distanceRange.maxDistanceCm
            ) {
                addOption(selectedDistanceCm);
            }
        }
    }

    if (distanceRange.maxDistanceCm > FIELD_SIZE_CM) {
        const firstFootprintAxis =
            distanceRange.minDistanceCm > FIELD_SIZE_CM
                ? resolveAdvancedSowingLayout({
                      ...distanceRange,
                      selectedDistanceCm: distanceRange.minDistanceCm,
                  }).fieldSpanRows
                : 2;
        const lastFootprintAxis = resolveAdvancedSowingLayout({
            ...distanceRange,
            selectedDistanceCm: distanceRange.maxDistanceCm,
        }).fieldSpanRows;
        transitionCount += lastFootprintAxis - firstFootprintAxis + 1;

        if (transitionCount > MAX_ADVANCED_SOWING_LAYOUT_OPTIONS) {
            throw new RangeError(
                'Advanced Sowing range produces too many layout options.',
            );
        }

        for (
            let fieldsPerAxis = firstFootprintAxis;
            fieldsPerAxis <= lastFootprintAxis;
            fieldsPerAxis += 1
        ) {
            const selectedDistanceCm = fieldsPerAxis * FIELD_SIZE_CM;
            if (
                selectedDistanceCm >= distanceRange.minDistanceCm &&
                selectedDistanceCm <= distanceRange.maxDistanceCm
            ) {
                addOption(selectedDistanceCm);
            }
        }
    }

    return Array.from(optionsByLayoutKey.values()).sort(
        (left, right) =>
            left.selectedDistanceCm - right.selectedDistanceCm ||
            left.layoutKey.localeCompare(right.layoutKey),
    );
}

/**
 * Resolves a square/rectangular footprint using the raised-bed field numbering
 * currently used by the Garden HUD. Position zero is the bottom-right field,
 * so the anchor is interpreted as the footprint's visual top-left field.
 */
export function getAdvancedSowingFootprintPositions({
    anchorPositionIndex,
    bedFieldCount = ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    bedColumnCount = ADVANCED_SOWING_BED_COLUMN_COUNT,
    fieldSpanColumns,
    fieldSpanRows,
}: AdvancedSowingFootprintInput) {
    const {
        bedColumnCount: safeBedColumnCount,
        bedFieldCount: safeBedFieldCount,
        bedRowCount,
    } = resolveAdvancedSowingBedGeometry({ bedColumnCount, bedFieldCount });
    const safeFieldSpanColumns = requirePositiveSafeInteger(
        fieldSpanColumns,
        'Footprint column span',
    );
    const safeFieldSpanRows = requirePositiveSafeInteger(
        fieldSpanRows,
        'Footprint row span',
    );

    if (
        !Number.isSafeInteger(anchorPositionIndex) ||
        anchorPositionIndex < 0 ||
        anchorPositionIndex >= safeBedFieldCount
    ) {
        throw new RangeError('Anchor position is outside the raised bed.');
    }

    const anchorVisualIndex = safeBedFieldCount - 1 - anchorPositionIndex;
    const anchorRow = Math.floor(anchorVisualIndex / safeBedColumnCount);
    const anchorColumn = anchorVisualIndex % safeBedColumnCount;

    if (
        anchorRow + safeFieldSpanRows > bedRowCount ||
        anchorColumn + safeFieldSpanColumns > safeBedColumnCount
    ) {
        throw new RangeError(
            'Sowing footprint extends outside the raised bed.',
        );
    }

    const positions: number[] = [];
    for (let rowOffset = 0; rowOffset < safeFieldSpanRows; rowOffset += 1) {
        for (
            let columnOffset = 0;
            columnOffset < safeFieldSpanColumns;
            columnOffset += 1
        ) {
            const visualIndex =
                (anchorRow + rowOffset) * safeBedColumnCount +
                anchorColumn +
                columnOffset;
            positions.push(safeBedFieldCount - 1 - visualIndex);
        }
    }

    return positions;
}

export function buildAdvancedSowingCartConfigurationV1({
    anchorPositionIndex,
    bedFieldCount,
    ...layoutInput
}: BuildAdvancedSowingCartConfigurationV1Input): AdvancedSowingCartConfigurationV1 {
    const layout = resolveAdvancedSowingLayout(layoutInput);
    const occupiedPositionIndices = getAdvancedSowingFootprintPositions({
        anchorPositionIndex,
        bedFieldCount,
        fieldSpanColumns: layout.fieldSpanColumns,
        fieldSpanRows: layout.fieldSpanRows,
    });

    return {
        anchorPositionIndex,
        bedFieldCount,
        fieldSpanColumns: layout.fieldSpanColumns,
        fieldSpanRows: layout.fieldSpanRows,
        layoutKey: layout.layoutKey,
        maxDistanceCm: layout.maxDistanceCm,
        minDistanceCm: layout.minDistanceCm,
        occupiedPositionIndices,
        optimalDistanceCm: layout.optimalDistanceCm,
        plantCount: layout.plantCount,
        plantsPerAxis: layout.plantsPerAxis,
        selectedDistanceCm: layout.selectedDistanceCm,
        version: 1,
    };
}

const advancedSowingCartConfigurationV1Keys = new Set([
    'anchorPositionIndex',
    'bedFieldCount',
    'fieldSpanColumns',
    'fieldSpanRows',
    'layoutKey',
    'maxDistanceCm',
    'minDistanceCm',
    'occupiedPositionIndices',
    'optimalDistanceCm',
    'plantCount',
    'plantsPerAxis',
    'selectedDistanceCm',
    'version',
]);

function isUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function invalidCartConfiguration(reason: string): never {
    throw new TypeError(
        `Invalid Advanced Sowing cart configuration: ${reason}`,
    );
}

function requireCartConfigurationNumber(
    value: Record<string, unknown>,
    key: string,
) {
    const property = value[key];
    if (typeof property !== 'number') {
        invalidCartConfiguration(`${key} must be a number.`);
    }

    return property;
}

function requireMatchingCartConfigurationProperty(
    value: Record<string, unknown>,
    key: string,
    expected: number | string,
) {
    if (value[key] !== expected) {
        invalidCartConfiguration(`${key} does not match the derived layout.`);
    }
}

/**
 * Parses an untrusted version-one cart value and returns a freshly derived,
 * canonical configuration. Unknown, missing, or tampered properties fail.
 */
export function parseAdvancedSowingCartConfigurationV1(
    value: unknown,
): AdvancedSowingCartConfigurationV1 {
    if (!isUnknownRecord(value)) {
        invalidCartConfiguration('expected an object.');
    }

    const keys = Object.keys(value);
    if (
        keys.length !== advancedSowingCartConfigurationV1Keys.size ||
        keys.some((key) => !advancedSowingCartConfigurationV1Keys.has(key))
    ) {
        invalidCartConfiguration('properties do not match version one.');
    }
    if (value.version !== 1) {
        invalidCartConfiguration('version must be 1.');
    }

    const expected = buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: requireCartConfigurationNumber(
            value,
            'anchorPositionIndex',
        ),
        bedFieldCount: requireCartConfigurationNumber(value, 'bedFieldCount'),
        maxDistanceCm: requireCartConfigurationNumber(value, 'maxDistanceCm'),
        minDistanceCm: requireCartConfigurationNumber(value, 'minDistanceCm'),
        optimalDistanceCm: requireCartConfigurationNumber(
            value,
            'optimalDistanceCm',
        ),
        selectedDistanceCm: requireCartConfigurationNumber(
            value,
            'selectedDistanceCm',
        ),
    });

    requireMatchingCartConfigurationProperty(
        value,
        'layoutKey',
        expected.layoutKey,
    );
    requireMatchingCartConfigurationProperty(
        value,
        'plantsPerAxis',
        expected.plantsPerAxis,
    );
    requireMatchingCartConfigurationProperty(
        value,
        'plantCount',
        expected.plantCount,
    );
    requireMatchingCartConfigurationProperty(
        value,
        'fieldSpanRows',
        expected.fieldSpanRows,
    );
    requireMatchingCartConfigurationProperty(
        value,
        'fieldSpanColumns',
        expected.fieldSpanColumns,
    );

    const occupiedPositionIndices = value.occupiedPositionIndices;
    if (
        !isUnknownArray(occupiedPositionIndices) ||
        occupiedPositionIndices.length !==
            expected.occupiedPositionIndices.length ||
        occupiedPositionIndices.some(
            (positionIndex, index) =>
                positionIndex !== expected.occupiedPositionIndices[index],
        )
    ) {
        invalidCartConfiguration(
            'occupiedPositionIndices do not match the derived footprint.',
        );
    }

    return expected;
}

export function parseAdvancedSowingSelectionRequestV1(
    value: unknown,
): AdvancedSowingSelectionRequestV1 {
    if (
        !isUnknownRecord(value) ||
        !hasExactKeys(value, ['kind', 'selectedDistanceCm', 'version']) ||
        value.kind !== advancedSowingSelectionRequestKind ||
        value.version !== 1 ||
        typeof value.selectedDistanceCm !== 'number' ||
        !Number.isFinite(value.selectedDistanceCm) ||
        value.selectedDistanceCm <= 0
    ) {
        throw new TypeError('Invalid Advanced Sowing selection request.');
    }

    return {
        kind: advancedSowingSelectionRequestKind,
        selectedDistanceCm: value.selectedDistanceCm,
        version: 1,
    };
}

export function parseAdvancedSowingCartAuthorizationV1(
    value: unknown,
): AdvancedSowingCartAuthorizationV1 {
    if (
        !isUnknownRecord(value) ||
        !hasExactKeys(value, ['kind', 'plan', 'version']) ||
        value.kind !== advancedSowingCartAuthorizationKind ||
        value.version !== 1
    ) {
        throw new TypeError('Invalid Advanced Sowing cart authorization.');
    }

    return {
        kind: advancedSowingCartAuthorizationKind,
        plan: parseAdvancedSowingCartConfigurationV1(value.plan),
        version: 1,
    };
}

export function buildAdvancedSowingSelectionSummaryV1(
    value: unknown,
): AdvancedSowingSelectionSummaryV1 {
    const { plan } = parseAdvancedSowingCartAuthorizationV1(value);
    return {
        fieldSpanColumns: plan.fieldSpanColumns,
        fieldSpanRows: plan.fieldSpanRows,
        kind: advancedSowingSelectionSummaryKind,
        layoutKey: plan.layoutKey,
        occupiedPositionIndices: [...plan.occupiedPositionIndices],
        plantCount: plan.plantCount,
        selectedDistanceCm: plan.selectedDistanceCm,
        version: 1,
    };
}
